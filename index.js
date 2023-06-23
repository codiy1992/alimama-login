const puppeteer = require("puppeteer-extra");
const fs = require("fs");
const schedule = require("node-schedule");
const axios = require("axios");

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

/**
 *
 * DEBUG=true \
 * HEADFUL=true \
 * API_ENDPOINT=https://api.test.com/cookie/upload \
 * ALIMAMA_USERNAME=xxx \
 * ALIMAMA_PASSWORD=yyy \
 * node index.js
 */
(async () => {
    let launchArgs = [
        "--no-xshm",
        "--no-zygote",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        // "--proxy-server=" + process.env.PROXY_SERVER || "127.0.0.1:7890",
        // "--auto-open-devtools-for-tabs",
    ];
    if (process.env.DEBUG) {
        launchArgs.push("--remote-debugging-port=9222");
        launchArgs.push("--remote-debugging-address=0.0.0.0");
    }
    const browser = await puppeteer.launch({
        headless: process.env.HEADFUL,
        slowMo: 200,
        defaultViewport: null, //{ width: 1080, height: 700 },
        executablePath:
            process.env.EXECUTABLE_PATH || "/usr/bin/google-chrome-stable",
        args: launchArgs,
    });

    // Close Default Page And Create New Page
    const [defaultPage] = await browser.pages();
    defaultPage.close();
    const page = await browser.newPage();

    try {
        // Load Cookie If Exists
        const cookies = fs.readFileSync(
            "storage/cookies/alimama." + process.env.ALIMAMA_USERNAME + ".json",
            "utf8"
        );
        const deserializedCookies = JSON.parse(cookies);
        await page.setCookie(...deserializedCookies);
        await page.goto("https://pub.alimama.com/");
        // 是否是已登陆待进入后台
        if (await page.waitForSelector("div[mxv='biz'] div.clearfix")) {
            await page.waitForTimeout(1000);
            await page.hover("div[mxv='biz'] div.clearfix");
            await page.click("div[mxv='biz'] div.clearfix").catch((e) => e);
        }
        // 是否已进入后台
        await page.waitForSelector("#widget-rightMsg > span");
    } catch (e) {
        console.log(e.message);
        // 去登陆
        await loginAlimama(browser);
        await page.goto("https://pub.alimama.com/");
        if (await page.waitForSelector("div[mxv='biz'] div.clearfix")) {
            await page.waitForTimeout(1000);
            await page.hover("div[mxv='biz'] div.clearfix");
            await page.click("div[mxv='biz'] div.clearfix").catch((e) => e);
        }
        await page.waitForSelector("#widget-rightMsg > span");
    }

    console.log(currentTime() + "[Alimama] Enter Successfully!");
    saveAndUploadCookies(page);

    schedule.scheduleJob("0 * * * * *", async () => {
        // 刷新页面
        let date = new Date();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        if (minutes % 5 == 0) {
            console.log(currentTime() + "[Alimama] Refreshing to Keep Alive!");
            (async () => {
                await axios
                    .get(
                        process.env.API_ENDPOINT + "/api/taobao/cookies/taobao"
                    )
                    .then(function (res) {
                        if (res.data.length > 0) {
                            fs.writeFileSync(
                                "storage/cookies/taobao." +
                                    process.env.ALIMAMA_USERNAME +
                                    ".json",
                                JSON.stringify(res.data, null, 2)
                            );
                            page.setCookie(...res.data);
                            console.log(
                                currentTime() + "[Taobao] Save new Cookies!"
                            );
                        }
                    })
                    .catch(function (err) {
                        console.log(err.message);
                    });

                await axios
                    .get(
                        process.env.API_ENDPOINT + "/api/taobao/cookies/alimama"
                    )
                    .then(function (res) {
                        if (res.data.length > 0) {
                            fs.writeFileSync(
                                "storage/cookies/alimama." +
                                    process.env.ALIMAMA_USERNAME +
                                    ".json",
                                JSON.stringify(res.data, null, 2)
                            );
                            page.setCookie(...res.data);
                            console.log(
                                currentTime() + "[Alimama] Save new Cookies!"
                            );
                        }
                    })
                    .catch(function (err) {
                        console.log(err.message);
                    });

                const pages = [
                    "https://pub.alimama.com/portal/v2/tool/links/page/home/index.htm",
                    "https://pub.alimama.com/portal/v2/tool/toolServiceProviderMarket/index.htm",
                    "https://pub.alimama.com/portal/v2/tool/materialPromoManage/index.htm",
                    "https://pub.alimama.com/portal/v2/pages/tool/multiPromo/index.htm",
                    "https://pub.alimama.com/portal/tool/tlj/account-pro/index.htm",
                    "https://pub.alimama.com/portal/tool/tlj/plan/index.htm",
                    "https://pub.alimama.com/portal/tool/query/index.htm",
                ];
                await page.goto(
                    pages[Math.floor(Math.random() * pages.length)]
                );
                try {
                    await page.waitForSelector("#widget-rightMsg > span");
                    saveAndUploadCookies(page);
                } catch (e) {
                    console.log(
                        currentTime() + "[Alimama] Account ReLogin Required!"
                    );
                    await loginAlimama(browser);
                }
            })();
        }
    });
})();

async function saveAndUploadCookies(page) {
    // 收集alimama的cookie
    const alimama_cookies = await page.cookies();
    fs.writeFileSync(
        "storage/cookies/alimama." + process.env.ALIMAMA_USERNAME + ".json",
        JSON.stringify(alimama_cookies, null, 2)
    );

    // 上传 cookie
    await axios
        .post(process.env.API_ENDPOINT + "/api/taobao/alimama/cookie", {
            cookie: alimama_cookies,
        })
        .then(function (res) {
            console.log(currentTime() + "[Alimama] Post Cookies Successfully");
            console.log(res.data);
        })
        .catch(function (err) {
            console.log(err.message);
        });
}

/**
 * alimama Login
 */
async function loginAlimama(browser) {
    // Login alimama By Logined Google Account
    const [page] = await browser.pages();
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "language", {
            get: function () {
                return "zh-CN";
            },
        });
        Object.defineProperty(navigator, "languages", {
            get: function () {
                return ["en", "zh-CN", "zh"];
            },
        });
    });
    try {
        // Load Cookie If Exists
        const cookies = fs.readFileSync(
            "storage/cookies/taobao." + process.env.ALIMAMA_USERNAME + ".json",
            "utf8"
        );
        const deserializedCookies = JSON.parse(cookies);
        await page.setCookie(...deserializedCookies);
        await page.goto(
            "https://login.taobao.com/member/login.jhtml?style=mini&from=alimama"
        );
        await page.waitForSelector(
            "#login > div.login-content.nc-outer-box > div > div.has-login-user-icon > img"
        );
        await page.hover(
            "#login > div.login-content.nc-outer-box > div > div.fm-btn"
        );
        await page.waitForTimeout(500);
        await page
            .click("#login > div.login-content.nc-outer-box > div > div.fm-btn")
            .catch((e) => e);

        // 2秒后按钮还在, 说明点击不生效
        await page.waitForTimeout(2000);
        if (
            await page.waitForSelector(
                "#login > div.login-content.nc-outer-box > div > div.fm-btn"
            )
        ) {
            console.log(
                currentTime() + "[Taobao] >> Click Login Button Failed! <<"
            );
            try {
                // 滑块验证
                slideValidtor(
                    page,
                    "#baxia-smsLogin > div > iframe",
                    "#nc_1_n1z"
                );
            } catch (e) {}
        }
        // 判断是否有滑块
    } catch (e) {
        console.log(e.message);
        await page.goto(
            "https://login.taobao.com/member/login.jhtml?style=mini&from=alimama"
        );
        // 填写账号密码
        await page.waitForSelector("#fm-login-id");
        await page.type("#fm-login-id", process.env.ALIMAMA_USERNAME);
        await page.waitForSelector("#fm-login-password");
        await page.type("#fm-login-password", process.env.ALIMAMA_PASSWORD);

        // 验证是否有滑块
        await slideValidtor(
            page,
            "#baxia-password > div > iframe",
            "#nc_1_n1z"
        );

        // 点击登陆
        if (await page.waitForSelector("#login-form > div.fm-btn > button")) {
            await page.hover("#login-form > div.fm-btn > button");
            await page.waitForTimeout(500);
            await page
                .click("#login-form > div.fm-btn > button")
                .catch((e) => e);
        }

        // 等待进入 www.alimama.com
        await page.waitForSelector("#header-info", {
            timeout: 6000000,
        });

        // 收集alimama的cookie
        const alimama_cookies = await page.cookies();
        fs.writeFileSync(
            "storage/cookies/alimama." + process.env.ALIMAMA_USERNAME + ".json",
            JSON.stringify(alimama_cookies, null, 2)
        );
    }

    // 收集taobao的cookie
    await page.goto(
        "https://login.taobao.com/member/login.jhtml?style=mini&from=alimama&redirectURL=http%3A%2F%2Flogin.taobao.com%2Fmember%2Ftaobaoke%2Flogin.htm%3Fis_login%3d1&full_redirect=true&disableQuickLogin=false"
    );

    await page.waitForSelector(
        "#login > div.login-content.nc-outer-box > div > div.has-login-user-icon > img"
    );

    const taobao_cookies = await page.cookies();
    fs.writeFileSync(
        "storage/cookies/taobao." + process.env.ALIMAMA_USERNAME + ".json",
        JSON.stringify(taobao_cookies, null, 2)
    );

    console.log(currentTime() + " [Taobao] Login Successfully");
}

async function slideValidtor(page, iframe_selector, span_selector) {
    if (await page.waitForSelector(iframe_selector)) {
        const frames = await page.frames();
        const frame = frames.find(
            (f) => f.url().indexOf("login.taobao.com") > -1
        );
        const iframe = await page.$(iframe_selector);

        // 滑槽位置 和 滑块大小
        const iframe_rect = await iframe.boundingBox();
        // await frame.waitForSelector(span_selector);
        // const span = await frame.$(span_selector);
        const span_rect = { x: 0, y: 0, width: 42, height: 34 };
        // 确定鼠标起始位置
        const startX = iframe_rect.x + span_rect.width / 2 - 1;
        const startY = iframe_rect.y + span_rect.height / 2;
        const endX =
            iframe_rect.x + iframe_rect.width - span_rect.width / 2 + 5;
        const endY = startY;
        const sX = startX + 40;
        const sY = startY + 60;

        // 重置鼠标位置，然后移动到鼠标初始位置, 从鼠标初始位置减速移动到滑块初始位置
        await page.mouse.reset();
        await page.mouse.move(sX, sY).catch((e) => e);
        const slowDownX = uniformDeceleration(sX, startX, 0.6);
        const slowDownY = uniformDeceleration(sY, startY, 0.6);
        for (let t = 0; t <= 0.6; t += 0.2) {
            const x = slowDownX(t);
            const y = slowDownY(t);
            const ts = Date.now() / 1000;
            await page.mouse.move(x, y).catch((e) => e); // 单次move 似乎要0.22秒
            const td = Date.now() / 1000;
            console.log(
                x.toFixed(2).toString() +
                    ", " +
                    y.toFixed(2).toString() +
                    ", " +
                    (td - ts).toFixed(2).toString()
            );
        }
        console.log("---------");
        // 按下鼠标,准备拖动
        await page.waitForTimeout(200);
        await page.mouse.down().catch((e) => e);
        await page.waitForTimeout(200);

        // 计算拖动距离和时间
        const distance = endX - startX;
        const duration1 = 1;
        const duration2 = 0.5;

        // 模拟鼠标移动和拖动
        const speedUpX = uniformAcceleration(startX, (endX / 3) * 2, duration1);
        const slowDownX2 = uniformDeceleration((endX / 3) * 2, endX, duration2);
        const time_start = Date.now() / 1000;
        for (let t = 0; t <= duration1; t += 0.22) {
            const x = speedUpX(t);
            const y = startY + Math.random() * 2 - 0.5; // 添加随机偏移量
            const ts = Date.now() / 1000;
            await page.mouse.move(x, y).catch((e) => e); // 单次move 似乎要0.22秒
            const td = Date.now() / 1000;
            console.log(
                x.toFixed(2).toString() +
                    ", " +
                    y.toFixed(2).toString() +
                    ", " +
                    (td - ts).toFixed(2).toString()
            );
        }
        console.log("---------");
        for (let t = 0; t <= duration2; t += 0.22) {
            const x = slowDownX2(t);
            const y = startY + Math.random() * 2 - 0.5; // 添加随机偏移量
            const ts = Date.now() / 1000;
            await page.mouse.move(x, y).catch((e) => e); // 单次move 似乎要0.22秒
            const td = Date.now() / 1000;
            console.log(
                x.toFixed(2).toString() +
                    ", " +
                    y.toFixed(2).toString() +
                    ", " +
                    (td - ts).toFixed(2).toString()
            );
            // await page.waitForTimeout(10);
            // await page.screenshot({
            //     path: "./storage/debug/" + x + ".jpg",
            // });
        }

        const time_end = Date.now() / 1000;
        console.log(time_end - time_start);
        await page.waitForTimeout(200);
        await page.mouse.up().catch((e) => e);
        if (iframe_selector == "#baxia-password > div > iframe") {
            await page.screenshot({
                path: "./storage/debug/0.jpg",
            });
        } else {
            await page.screenshot({
                path: "./storage/debug/1.jpg",
            });
        }
    }
}

function uniformAcceleration(start, end, duration) {
    const distance = end - start;
    const acceleration = distance / duration ** 2;
    return (t) => start + 1.2 * acceleration * t ** 2;
}

function uniformDeceleration(start, end, duration) {
    const distance = end - start;
    const acceleration = distance / duration ** 0.5;
    return (t) => end - 1.2 * acceleration * (duration - t) ** 2;
}

function currentTime() {
    const date = new Date();
    const options = {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    };
    const formattedDate = date
        .toLocaleString("en-US", options)
        .replace(/(\d+)\/(\d+)\/(\d+),/, "$3/$1/$2");
    return formattedDate;
}
