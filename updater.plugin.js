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
            this.request.absort();
            this.request = null;
        }

        this.checking = false;
    }

    getPluginPath() {
        return path.join(
            BdApi.Plugins.folder,
            __filename
        );
    }

    async download(url) {
        const controller = new AbortController();
        this.controller = controller;

        try {
            const response = await BdApi.Net.fetch(url, {
                method: "GET",
                signal: controller.signal,
                headers: {
                    "Cache-Control": "no-cache"
                }
            });

            console.log("[Denkai] HTTP Status:", response.status);

            if (!response.ok) {
                throw new Error(
                    `GitHub HTTP ${response.status} ${response.statusText}`
                );
            }

            const data = await response.arrayBuffer();
            return Buffer.from(data);
        } finally {
            if (this.controller === controller) {
                this.controller = null;
            }
        }
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

            const isSame =
                remote.length === local.length &&
                remote.every((byte, index) => byte === local[index]);

            if (isSame) {
                console.log("[Denkai] Already up to date.");
                return;
            }

            const source = remote.toString("utf8");

            if (
                !source.includes("@name Denkai")
            ) {
                throw new Error(
                    "Invalid Denkai plugin source"
                );
            }

            if (this.stopped) {
                return;
            }

            this.reloading = true;

            console.log(
                "[Denkai] New version detected."
            );

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
                "Denkai 업데이트 완료. 재시작합니다.", {
                    type: "success"
                }
            );

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
