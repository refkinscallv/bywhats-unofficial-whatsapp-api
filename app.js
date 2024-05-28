/**
 * packages
 */
require("dotenv").config();

const { Helper }            = require("./lib/Helper");
const { WhatsApp }          = require("./lib/WhatsApp");
const { MessageMedia }      = require("whatsapp-web.js");
const http                  = require("http");
const fs                    = require("fs");
const qs                    = require("qs");
const express               = require("express");
const axios                 = require("axios");
const cors                  = require("cors");
const multer                = require("multer");
const path                  = require("path");
const socketIO              = require("socket.io");

/**
 * initialize
 */
const PORT                  = process.env.PORT || 3000;
const app                   = express();
const server                = http.createServer(app);
const io                    = socketIO(server, { cors: { origin: "*" } });
const helper                = new Helper(io);
const whatsApp              = new WhatsApp(io);
const appName               = process.env.APPNAME;
const multerUpload          = multer({
    storage: multer.diskStorage({
        destination: (req, file, callback) => {
            callback(null, 'resources/media/');
        },
        filename: (req, file, callback) => {
            callback(null, `${Math.random().toString(36).slice(2)}-${file.originalname}`)
        }
    })
});
const request               = (url, data) => {
    return axios.post(`${process.env.APIURL}/${url}`, qs.stringify(data));
}

/**
 * middlewares
 */
app.use(cors(helper.dynamicExpressCors()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((err, req, res, next) => {
    if (err) {
        res.status(403).json({ status: false, code: 403, message: 'Forbidden Access' });
    } else {
        next();
    }
});

/**
 * whatsapp init
 */
whatsApp.init();

/**
 * routes
 */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "resources", "public/index.html")));

app.post("/init", (req, res) => {
    if(!req.body && !req.body.init){
        helper.outputJson(res, {
            status: false,
            code: 400,
            message: "Request body is required"
        });
    }

    const init = req.body.init;

    if(init){
        io.emit("INIT", {
            message: `[${appName}] Waiting for initialization in 15 seconds`,
            result: null
        });

        setTimeout(() => {
            whatsApp.init();
            helper.outputJson(res, {
                status: true,
                code: 200,
                message: "Initialization was successful"
            });
        }, 15000);
    } else {
        helper.outputJson(res, {
            status: true,
            code: 400,
            message: "Initialization failed"
        });
    }
});

app.post("/send-message", async (req, res) => {
    if(!req.body || !req.body.number || !req.body.message){
        helper.outputJson(res, {
            status: false,
            code: 400,
            message: "Request body is required"
        });
    }

    const client = whatsApp.client;
    const number = helper.phoneFormat(req.body.number);
    const message = req.body.message;

    try {
        const checkNum = await helper.checkRegNumber(client, number);
        if (!checkNum) {
            helper.outputJson(res, {
                code: 422,
                status: false,
                message: "Phone number is not registered"
            });
        }

        client.sendMessage(number, message).then(response => {
            helper.outputJson(res, {
                status: true,
                code: 200,
                message: "Success",
                result: response
            });

            if(!response.isStatus){
                const data = {};

                data.from_me        = response.fromMe;
                data.me             = response.from.replace("@c.us", "");
                data.raw            = response;
                data.chat_id        = response.id.id;
                data.type           = response.type;
                data.has_media      = response.hasMedia;
                data.message_ack    = response.ack;
                data.body           = response.body;

                request("store_message", data);
            }
        });
    } catch (error) {
        helper.outputJson(res, {
            code: 500,
            status: false,
            msg: `Internal server error`
        });
    }
});

app.post("/send-media", multerUpload.single("file"), async (req, res) => {
    if(!req.body || !req.body.number || !req.body.caption){
        helper.outputJson(res, {
            status: false,
            code: 400,
            message: "Request body is required"
        });
    }

    if(!req.file){
        helper.outputJson(res, {
            code: 400,
            status: false,
            message: `file are required`
        });
    }

    const client = whatsApp.client;
    const number = helper.phoneFormat(req.body.number);
    const caption = req.body.caption;
    
    try {
        const checkNum = await helper.checkRegNumber(client, number);
        if (!checkNum) {
            helper.outputJson(res, {
                code: 422,
                status: false,
                message: "Phone number is not registered"
            });
        }

        const file = req.file;
        const fileMimeType = req.file.mimetype;
        const fileName = file.filename;
        const fileSize = file.size;
        const fileData = fs.readFileSync(`resources/media/${fileName}`, {
            encoding: 'base64',
        });
        const media = new MessageMedia(fileMimeType, fileData, fileName, fileSize);

        client.sendMessage(number, media, { caption: caption }).then(response => {
            helper.outputJson(res, {
                status: true,
                code: 200,
                message: "Success",
                result: response
            });

            if(!response.isStatus){
                const data = {};

                data.from_me        = response.fromMe;
                data.me             = response.from.replace("@c.us", "");
                data.raw            = response;
                data.chat_id        = response.id.id;
                data.type           = response.type;
                data.has_media      = response.hasMedia;
                data.message_ack    = response.ack;
                data.body           = response.body;

                request("store_message", data);
            }
        });
    } catch (error) {
        helper.outputJson(res, {
            code: 500,
            status: false,
            message: error
        });
    }
});

/**
 * running server
 */
server.listen(PORT, () => {
    console.log(`[SERVER] : Application running on port ${PORT}`);
});