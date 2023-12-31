import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";
import 'dotenv/config'

import { ogg } from "./ogg.js";
import { openai } from "./openai.js";
import {textConverter} from "./textToSpeech.js";

const INITIAL_SESSION = {
    messages: [],
}

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(session());

bot.command("new", async (ctx) => {
    ctx.session = INITIAL_SESSION;
    await ctx.reply("Чекаю Вашого голосового чи текстового повідомлення");
})

bot.command("start", async (ctx) => {
    ctx.session = INITIAL_SESSION;
    await ctx.reply("Чекаю Вашого голосового чи текстового повідомлення");
})

bot.on(message("voice"), async (ctx) => {
    ctx.session = ctx.session ?? INITIAL_SESSION;
    try { 
        await ctx.reply(code("Повідомлення прийнято. Незабаром буде результат..."));
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        const userId = String(ctx.message.from.id);
        const oggPath = await ogg.create(link.href, userId);
        const mp3Path = await ogg.toMP3(oggPath, userId);

        const text = await openai.transcription(mp3Path);
        await ctx.reply(code(`Ваше запитання: ${text}`));

        ctx.session.messages.push({ role: openai.roles.USER, content: text });
        const response = await openai.chat(ctx.session.messages);
        ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content });

        const source = await textConverter.textToSpeech(response.content);
        await ctx.sendAudio({ source });
        await ctx.reply(response.content);
    }
    catch (e) {
        console.log("Error while error message", e.message);
    }
})

bot.on(message("text"), async (ctx) => {
    ctx.session = ctx.session ?? INITIAL_SESSION;
    try { 
        await ctx.reply(code("Повідомлення прийнято. Незабаром буде результат..."));

        ctx.session.messages.push({ role: openai.roles.USER, content: ctx.message.text });
        const response = await openai.chat(ctx.session.messages);
        ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content });

        const source = await textConverter.textToSpeech(response.content);
        await ctx.sendAudio({ source });
        await ctx.reply(response.content);
    }
    catch (e) {
        console.log("Error while error message", e.message);
    }
})

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));