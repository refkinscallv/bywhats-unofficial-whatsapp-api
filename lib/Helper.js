/**
 * packages
 */
require("dotenv").config();
const fs    = require("fs");
const path  = require("path");

class Helper {
    
    constructor(io) {
        /**
         * express cors initialize
         */
        this.io                     = io;
        this.permissionFilePath     = path.join(__dirname, "../storage", "permission.json");
        this.permissionDataCache    = {};
        this.dynamicExpressCorsInit();
    }

    /**
     * general helper
     */
    currentDate(){
        const date = new Date();
        const pad = (num) => String(num).padStart(2, '0');

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    phoneFormat(number){
        let phoneFormatted = number.replace(/\D/g, '');

        if (phoneFormatted.startsWith("0")) {
            phoneFormatted = `62${phoneFormatted.substr(1)}`;
        }

        return phoneFormatted.endsWith("@c.us") ? phoneFormatted : `${phoneFormatted}@c.us`;
    }
    
    outputJson(res, opt){
        const { code = 400, status = false, message = null, result = null } = opt;
        let response = {
            status: status,
            code: code,
            message: message,
            result: result
        };
        
        return res.status(code).json(response);
    }

    emitter(event, data) {
        return this.io.emit(`${this.appName + event}`, data);
    }

    request(url, data) {
        return axios.post(`${process.env.APIURL}/${url}`, qs.stringify(data));
    }

    /**
     * express cors helper
     */
    dynamicExpressCorsInit() {
        this.readPermissionFile();
        fs.watch(this.permissionFilePath, (eventType, filename) => {
            if (filename && eventType === 'change') {
                this.readPermissionFile();
            }
        });
    }

    readPermissionFile() {
        fs.readFile(this.permissionFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error("Error reading permission file:", err);
                return;
            }
            try {
                this.permissionDataCache = JSON.parse(data);
            } catch (parseErr) {
                console.error("Error parsing permission data:", parseErr);
            }
        });
    }

    dynamicExpressCors(req, res) {
        return {
            origin: (origin, cb) => {
                const allowedOrigins = this.permissionDataCache || [];
                if (allowedOrigins.includes(origin) || !origin) {
                    cb(null, true);
                } else {
                    cb(new Error());
                }
            }
        };
    }

    async checkRegNumber(client, number){
        try {
            const isRegistered = await client.isRegisteredUser(number);
            return isRegistered;
        } catch (e) {
            console.error("Error checking registration:", e);
            return false;
        }
    }
}

module.exports = { Helper };