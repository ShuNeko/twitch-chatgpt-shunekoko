const express = require('express');
const request = require('request');
const app = express();
const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const GPT_MODE = process.env.GPT_MODE;

let file_context = "You are a helpful Twitch Chatbot.";

const messages = [
  { role: "system", content: "You are a helpful Twitch Chatbot." }
];

console.log("GPT_MODE is " + GPT_MODE);
console.log("History length is " + process.env.HISTORY_LENGTH);
console.log("OpenAI API Key: " + process.env.OPENAI_API_KEY);

app.use(express.json({ extended: true, limit: '1mb' }));

app.all('/', (req, res) => {
  console.log("Just got a request!");
  res.send('Yo!');
});

if (process.env.GPT_MODE === "CHAT") {
  fs.readFile("./file_context.txt", 'utf8', function (err, data) {
    if (err) throw err;
    console.log("Reading context file and adding it as system level message for the agent.");
    messages[0].content = data;
  });
} else {
  fs.readFile("./file_context.txt", 'utf8', function (err, data) {
    if (err) throw err;
    console.log("Reading context file and adding it in front of user prompts:");
    file_context = data;
    console.log(file_context);
  });
}

app.get('/gpt/:text', async (req, res) => {
  const text = req.params.text;
  const { Configuration, OpenAIApi } = require("openai");

  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const openai = new OpenAIApi(configuration);

  if (GPT_MODE === "CHAT") {
    messages.push({ role: "user", content: text });
    console.log("Conversations in History: " + ((messages.length / 2) - 1) + "/" + process.env.HISTORY_LENGTH);
    if (((messages.length / 2) - 1) > process.env.HISTORY_LENGTH) {
      console.log('Message amount in history exceeded. Removing oldest user and agent messages.');
      messages.splice(0, 2);
    }

    console.log("Messages: ");
    console.dir(messages, { depth: null });
    console.log("User Input: " + text);

    const response = await openai.createCompletion({
      engine: "gpt-3.5-turbo",
      prompt: messages,
      temperature: 0.5,
      maxTokens: 128,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    });

    if (response.choices && response.choices.length > 0) {
      let agent_response = response.choices[0].text;

      console.log("Agent answer: " + agent_response);
      messages.push({ role: "system", content: agent_response });

      if (agent_response.length > 399) {
        console.log("Agent answer exceeds twitch chat limit. Slicing to first 399 characters.");
        agent_response = agent_response.substring(0, 399);
        console.log("Sliced Agent answer: " + agent_response);
      }

      res.send(agent_response);
    } else {
      res.send("Something went wrong. Try again later!");
    }
  } else {
    const prompt = file_context + "\n\nQ:" + text + "\nA:";
    console.log("User Input: " + text);

    const response = await openai.createCompletion({
      engine: "text-davinci-003",
      prompt: prompt,
      temperature: 0.5,
      maxTokens: 128,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    });

    if (response.choices && response.choices.length > 0) {
      let agent_response = response.choices[0].text;

      console.log("Agent answer: " + agent_response);

      if (agent_response.length > 399) {
        console.log("Agent answer exceeds twitch chat limit. Slicing to first 399 characters.");
        agent_response = agent_response.substring(0, 399);
        console.log("Sliced Agent answer: " + agent_response);
      }

      res.send(agent_response);
    } else {
      res.send("Something went wrong. Try again later!");
    }
  }

});

app.listen(process.env.PORT || 3000);
