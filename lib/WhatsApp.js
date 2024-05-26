/**
 * packages
 */
require("dotenv").config();

const { Helper }            = require("./Helper");
const fs                    = require("fs");
const qs                    = require("qs");
const qrcode                = require("qrcode");
const axios                 = require("axios");
const { Client, LocalAuth } = require("whatsapp-web.js");

class WhatsApp {
    
    constructor(io){
        this.io         = io;
        this.helper     = new Helper(io);
        this.appName    = process.env.APPNAME;
        this.socketMsg  = (msg = false) => {
            return (msg ? `[${this.appName}] ${msg}` : `[${this.appName}]`)
        };
        this.client     = false;
    }
    
    init(){
        return this.main();
    }

    main(){
        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: "authSession",
                clientId: `session${this.appName}`
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--disable-setuid-sandbox',
                    '--no-first-run',
                    '--no-sandbox',
                    '--no-zygote',
                    '--deterministic-fetch',
                    '--disable-features=IsolateOrigins',
                    '--disable-site-isolation-trials'
                ]
            },
            webVersionCache: {
                type: "remote",
                remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html"
            }
        });

        // client.initialize();
        // client.initialize().catch(ex => {});
        client.initialize().catch(_ => _);
        

        /**
         * started listener
         */
        client.on("qr", (qr) => {
            qrcode.toDataURL(qr, (err, url) => {
                if(err){
                    this.emitter("QRERROR", {
                        message: this.socketMsg("Error Generating QR Code"),
                        result: null
                    });
                }

                this.emitter("QR", {
                    message: this.socketMsg("QR code generated successfully"),
                    result: url
                });

                this.request("update_device", {
                    status: "Unauthenticated",
                    modifieddate: this.helper.currentDate()
                });
            });
        });

        client.on("authenticated", () => {
            this.emitter("AUTHENTICATED", {
                message: this.socketMsg("Authenticated device"),
                result: null
            });

            this.request("update_device", {
                status: "Authenticated",
                modifieddate: this.helper.currentDate()
            });
        });

        client.on("auth_failure", () => {
            this.emitter("AUTHFAILURE", {
                message: this.socketMsg("Failed authentication"),
                result: null
            });

            this.request("update_device", {
                status: "Failed Authentication",
                modifieddate: this.helper.currentDate()
            });

            client.destroy();
            setTimeout(() => {
                this.removeSession();
            }, 5000);
        });

        client.on("ready", () => {
            this.emitter("READY", {
                message: this.socketMsg("Device ready"),
                result: null
            });

            this.request("update_device", {
                status: "Ready",
                modifieddate: this.helper.currentDate()
            });
        });

        client.on("disconnected", () => {
            this.emitter("DISCONNECTED", {
                message: this.socketMsg("Disconnected"),
                result: null
            });

            this.request("update_device", {
                status: "Disconnected",
                modifieddate: this.helper.currentDate()
            })

            client.destroy();
            setTimeout(() => {
                this.removeSession();
            }, 5000);
        });

        /**
         * ondemand listener
         */
        
        this.client = client;
    }

    socketMsg(msg = false){
        return (msg ? `[${appName}] ${msg}` : `[${appName}]`)
    };

    removeSession(retries = 0){
        const directoryPath = `./authSession/session-session${this.appName}`;
        const maxRetries = 10;
        const retryDelay = 1000;

        try {
            fs.rmSync(directoryPath, { recursive: true, force: true });
            this.request("update_device", {
                status: "Disconnected",
                modifieddate: this.helper.currentDate()
            });
            this.client = "null";
        } catch (err) {
            if (err.code === 'EBUSY' && retries < maxRetries) {
                console.warn(`Resource busy, retrying in ${retryDelay / 1000} seconds... (${retries + 1}/${maxRetries})`);
                setTimeout(() => this.removeSession(retries + 1), retryDelay);
            } else {
                console.error('Error removing directory:', err);
            }
        }
    }

    request(url, data) {
        return axios.post(`${process.env.APIURL}/${url}`, qs.stringify(data));
    }

    emitter(event, data) {
        return this.io.emit(`${this.appName + event}`, data);
    }

}

module.exports = { WhatsApp };