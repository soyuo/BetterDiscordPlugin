/**
 * @name Denkai
 * @author soyuo
 * @version 1.0.0
 * @description Self-updating BetterDiscord plugin.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

module.exports = class Denkai {
    constructor() {
        this.pluginName = "Denkai";

        this.updateUrl =
            "https://raw.githubusercontent.com/soyuo/BetterDiscordPlugin/main/denkai.plugin.js";

        this.intervalMs = 10 * 60 * 1000;

        this.timer = null;
        this.reloadTimer = null;
        this.request = null;

        this.checking = false;
        this.reloading = false;
        this.stopped = true;
    }

    start() {
        this.stopped = false;

        this.checkForUpdates();

        this.timer = setInterval(() => {
            this.checkForUpdates();
        }, this.intervalMs);
    }

    stop() {
        this.stopped = true;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
            this.reloadTimer = null;
        }

        if (this.request) {
            this.request.destroy();
            this.request = null;
        }

        this.checking = false;
    }

    getPluginPath() {
        return path.join(
            BdApi.Plugins.folder,
            "Denka.plugin.js"
        );
    }

    download(url) {
        return new Promise((resolve, reject) => {
            const request = https.get(
                url,
                {
                    headers: {
                        "User-Agent": "Denkai-Updater",
                        "Cache-Control": "no-cache"
                    },
                    timeout: 15000
                },
                (response) => {
                    if (response.statusCode !== 200) {
                        response.resume();

                        reject(
                            new Error(
                                `HTTP ${response.statusCode}`
                            )
                        );
                        return;
                    }

                    const chunks = [];
                    let size = 0;

                    response.on("data", (chunk) => {
                        size += chunk.length;

                        if (size > 5 * 1024 * 1024) {
                            response.destroy(
                                new Error("File too large")
                            );
                            return;
                        }

                        chunks.push(chunk);
                    });

                    response.on("end", () => {
                        resolve(Buffer.concat(chunks));
                    });

                    response.on("error", reject);
                }
            );

            this.request = request;

            request.on("timeout", () => {
                request.destroy(
                    new Error("Request timeout")
                );
            });

            request.on("error", reject);

            request.on("close", () => {
                if (this.request === request) {
                    this.request = null;
                }
            });
        });
    }

    async checkForUpdates() {
        if (
            this.stopped ||
            this.checking ||
            this.reloading
        ) {
            return;
        }

        this.checking = true;

        try {
            const filePath = this.getPluginPath();

            const remote = await this.download(
                this.updateUrl + "?t=" + Date.now()
            );

            if (this.stopped || this.reloading) {
                return;
            }

            const local = fs.readFileSync(filePath);

            // 정확하게 동일하면 아무 작업도 하지 않음
            if (remote.equals(local)) {
                return;
            }

            const source = remote.toString("utf8");

            // 기본적인 BetterDiscord 플러그인 형식 확인
            if (
                !source.includes("@name denkai") ||
                !source.includes("module.exports") ||
                !source.includes("checkForUpdates")
            ) {
                throw new Error(
                    "Invalid Denkai plugin source"
                );
            }

            // JavaScript 구문 검증
            const vm = require("vm");

            new vm.Script(source, {
                filename: "denkai.plugin.js"
            });

            if (this.stopped) {
                return;
            }

            this.reloading = true;

            console.log(
                "[Denkai] New version detected."
            );

            // 기존 코드 백업
            fs.writeFileSync(
                filePath + ".backup",
                local
            );

            // GitHub 코드로 교체
            fs.writeFileSync(
                filePath,
                remote
            );

            console.log(
                "[Denkai] Update installed."
            );

            BdApi.UI.showToast(
                "Denkai 업데이트 완료. 재시작합니다.",
                {
                    type: "success"
                }
            );

            // 재로드 대기 중에는 추가 검사하지 않음
            this.reloadTimer = setTimeout(() => {
                if (this.stopped) return;

                BdApi.Plugins.reload(
                    this.pluginName
                );
            }, 1000);

        } catch (error) {
            console.error(
                "[Denkai] Update failed:",
                error
            );

            this.reloading = false;
        } finally {
            this.checking = false;
        }
    }
};
