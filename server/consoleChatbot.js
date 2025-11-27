const dotenv = require('dotenv');
dotenv.config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const readline = require("readline");

// import dotenv from 'dotenv';
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import readline from "node:readline";
// import { stdin as input, stdout as output } from "node:process";


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const rl = readline.createInterface({
    input: process.stdin, output: process.stdout
});

async function run(){
    const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

    const chat = model.startChat({
        history: [],
        generationConfig: { maxOutputTokens: 1024 },
    }); 

    async function askAndRespond(){
        rl.question("You:", async (msg) => {
            if(msg.toLowerCase() === "exit"){
                console.log("Exiting chat...");
                rl.close();
                return;
            } else {
            const result = await chat.sendMessage(msg);
            const response = result.response;
            const text = await response.text();
            console.log("Chatbot: ", text);
            askAndRespond();
            }
        })
    }
    askAndRespond();
}

run();
