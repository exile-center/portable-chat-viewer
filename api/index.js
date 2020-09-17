const express = require('express');
const fs = require('fs');
const lineReader = require('reverse-line-reader');
const packageJson = require('./package.json');
const app = express();

// Constants
const CONFIG_PATH = './config.json';
const LINE_REGEX = /^(\d{4}\/\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2}) (\d+) (\w+) \[(\w+) .+\] (.+)$/;
const DEFAULT_LIMIT = 50;

// Load config
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`Configuration not found. Make sure to remove the ".default" from "${CONFIG_PATH}.default". Don't forget to adjust them!`);
  process.exit(1);
}
const {chatClientPath, port} = require(CONFIG_PATH);

// Initial checks
if (!fs.existsSync(chatClientPath)) {
  console.error(`Chat client file not found. Make sure to remove the "${chatClientPath}" really exists. Adjust the "config.json" if needed.`);
  process.exit(1);
}

app.get('/', async (request, response) => {
  const hrstart = process.hrtime();
  const currentCursor = request.query.cursor || null;
  
  let limit = parseInt(request.query.limit)
  if (isNaN(limit)) limit = DEFAULT_LIMIT;

  const messages = [];
  let lastCursor = null;

  lineReader.eachLine(chatClientPath, (line, isLast) => {
    const match = line.match(LINE_REGEX);
    if (!match) return;

    const [_match, date, time, cursor, _, _type, body] = match;
    if (!body.startsWith('@From')) return;

    if (!lastCursor) lastCursor = cursor;
    if (currentCursor && cursor === currentCursor) return false;
    
    messages.unshift({
      date,
      time,
      body
    });

    if (isLast) return false;
    if (messages.length === limit) return false;
  }).then(() => {
    const hrend = process.hrtime(hrstart);
    const processingTime = (hrend[0] * 1000) + (hrend[1] / 1000000);

    const payload = {
      'api-version': packageJson.version,
      'messages-count': messages.length,
      'processing-time': processingTime,
      cursor: lastCursor || currentCursor,
      messages
    };

    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(payload));
  });
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}, fronting the "${chatClientPath}" chat log file.`);
});
