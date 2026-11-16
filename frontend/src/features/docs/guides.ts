export type Guide = {
  title: string
  intro: string
  sections: {
    title: string
    text: string
    code?: string
    link?: { href: string; label: string }
    metrics?: { name: string; description: string }[]
  }[]
  source?: string
}

export const videoRouteSelection: Guide['sections'][number] = {
  title: 'Choose a route',
  text: 'For routes grouped by resolution, choose the resolution, billing mode and route in the model catalog. Use an API key for that route and send the same model ID with an explicit matching resolution, such as 720p.',
  code: 'curl {{origin}}/v1/videos -H "Authorization: Bearer $NEW_API_KEY" -H "Content-Type: application/json" -d \'{"model":"VIDEO_MODEL_ID","prompt":"A quiet mountain lake","seconds":5,"resolution":"720p"}\'',
}

export const guides: Record<string, Guide> = {
  'choose-model': {
    title: 'Choose a model',
    intro: 'Compare models, prices and routes in one place.',
    sections: [
      {
        title: 'Choose a model',
        text: 'Compare supported protocols, input and output types, and the full price breakdown. Copy the model ID exactly; availability depends on your key and group.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Performance',
        text: 'Success rate and recent history describe observed calls, not a guarantee. Check the sample size; missing measurements are not zero. First-token latency measures response start, while output speed measures streaming generation.',
        metrics: [
          {
            name: 'Success rate',
            description: 'The proportion of observed requests that succeeded. Consider the sample size and recent history.',
          },
          {
            name: 'Time to first token',
            description: 'Time until output begins. A shorter delay makes the first response appear sooner.',
          },
          {
            name: 'Output speed',
            description: 'Tokens generated per second during streaming. This is not a character count.',
          },
          {
            name: 'Price',
            description: 'Compare input, output and cache charges using the same units and the selected route.',
          },
        ],
      },
      {
        title: 'Choose a route',
        text: 'Compare routes for the same model. First check the protocol and capabilities your application needs, then compare reliability, latency, output speed and price.',
        link: { href: '/docs/choose-route', label: 'Choose a route' },
      },
    ],
  },
  'api-keys': {
    title: 'Manage API keys',
    intro: 'Manage keys for your applications and services.',
    sections: [
      {
        title: 'Create API key',
        text: 'Create a key in the console and choose the group used by your application. Keep the key on your server or in a local environment variable.',
        link: { href: '/keys', label: 'API keys' },
      },
      {
        title: 'Advanced settings',
        text: 'Use separate keys for applications. Set model limits, expiry and quota in the console, then check the models visible to that key before sending a request.',
      },
      {
        title: 'Security',
        text: 'Keep API keys private and out of shared code. If a key is exposed, disable it and create a replacement.',
        link: { href: '/keys', label: 'Manage API keys' },
      },
    ],
  },
  'quick-create-api-key': {
    title: 'Quick create API key',
    intro: 'Create a key in the selected group to use this route.',
    sections: [
      {
        title: 'Choose a model',
        text: 'Copy the actual model ID from the catalog and check its routes, prices and supported protocols.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Create API key',
        text: 'Create or choose an API key for the selected group. Changing only the model ID does not change the key group. Changing a key group affects every application using that key.',
        link: { href: '/keys', label: 'Manage API keys' },
      },
      {
        title: 'Verify the result',
        text: 'Check request logs after your first request to confirm the model and usage.',
        link: { href: '/usage-logs/common', label: 'Usage logs' },
      },
    ],
  },
  'getting-started': {
    title: 'Getting started',
    intro: 'Connect using this gateway address and an API key from your account.',
    sections: [
      {
        title: 'Create an account',
        text: 'Register or sign in before creating an API key.',
        link: { href: '/sign-up', label: 'Sign up' },
      },
      {
        title: 'Available balance',
        text: 'Check your account balance before the first request. If needed, open your wallet to review available recharge options.',
        link: { href: '/wallet', label: 'Wallet' },
      },
      {
        title: 'Choose a model',
        text: 'Copy the actual model ID from the catalog and check its routes, prices and supported protocols.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Choose a route',
        text: 'A catalog route represents a gateway group. Select an allowed group when creating your API key; group ratios and available models can differ. The gateway selects an eligible channel for each request.',
        link: { href: '/docs/choose-route', label: 'Choose a route' },
      },
      {
        title: 'Create API key',
        text: 'Create a key in the console and choose the group used by your application. Keep the key on your server or in a local environment variable.',
        link: { href: '/keys', label: 'Manage API keys' },
      },
      {
        title: 'CC Switch',
        text: 'Connect a selected model route to CC Switch.',
        link: { href: '/docs/cc-switch', label: 'CC Switch' },
      },
      {
        title: 'Codex CLI',
        text: 'Configure Codex CLI with a Responses-compatible gateway provider.',
        link: { href: '/docs/codex-cli', label: 'Codex CLI' },
      },
      {
        title: 'Claude Code',
        text: 'Configure Claude Code to use an Anthropic-compatible route on this gateway.',
        link: { href: '/docs/claude-code', label: 'Claude Code' },
      },
      {
        title: 'DeepSeek Harness',
        text: 'Connect DeepSeek Harness to this gateway using a custom model API.',
        link: { href: '/docs/deepseek-harness', label: 'DeepSeek Harness' },
      },
      {
        title: 'WorkBuddy',
        text: 'Connect WorkBuddy to this gateway with a custom model.',
        link: { href: '/docs/workbuddy', label: 'WorkBuddy' },
      },
      {
        title: 'CC Switch aggregation',
        text: 'Use models from multiple providers in CC Switch aggregation mode.',
        link: { href: '/docs/cc-switch-aggregation', label: 'CC Switch aggregation' },
      },
      {
        title: 'Models',
        text: 'Query the models visible to your API key.',
        code: 'curl {{origin}}/v1/models -H "Authorization: Bearer $NEW_API_KEY"',
      },
      {
        title: 'Send a request',
        text: 'For macOS or Linux, choose a route that supports Responses. Set NEW_API_KEY in your environment and replace your-model with its model ID. Running this example sends a real request.',
        code: `curl {{origin}}/v1/responses -H "Authorization: Bearer $NEW_API_KEY" -H "Content-Type: application/json" -d '{"model":"your-model","input":"Hello!"}'`,
      },
      {
        title: 'PowerShell 7',
        text: 'On Windows, set NEW_API_KEY in your environment and replace your-model with the model ID. Running this example sends a real request.',
        code: `Invoke-RestMethod -Uri '{{origin}}/v1/models' -Headers @{ Authorization = "Bearer $env:NEW_API_KEY" }
$body = @{ model = 'your-model'; input = 'Hello!' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri '{{origin}}/v1/responses' -Headers @{ Authorization = "Bearer $env:NEW_API_KEY" } -ContentType 'application/json' -Body $body`,
      },
      {
        title: 'View usage',
        text: 'Request logs show the model, usage, cost and failure details. Check the key, group and balance when a request fails.',
        link: { href: '/usage-logs/common', label: 'Usage logs' },
      },
      {
        title: 'Playground',
        text: 'Try a model in the playground. If local attachments are enabled, you can attach UTF-8 text or a PDF; the selected model must support PDF input.',
        link: { href: '/playground', label: 'Playground' },
      },
      {
        title: 'Attachments',
        text: 'Attached content is sent to the model provider and saved in this browser conversation. Unsent uploads expire after 24 hours. The actual model token usage may differ from the gateway estimate.',
      },
    ],
  },
  'models-and-routes': {
    title: 'Models, routes and API keys',
    intro: 'Choose a model for the task, a route for access, and an API key for your application.',
    sections: [
      {
        title: 'Choose a model',
        text: 'Compare supported protocols, input and output types, and the full price breakdown. Copy the model ID exactly; availability depends on your key and group.',
      },
      {
        title: 'Choose a route',
        text: 'A catalog route represents a gateway group. Select an allowed group when creating your API key; group ratios and available models can differ. The gateway selects an eligible channel for each request.',
      },
      {
        title: 'Create API key',
        text: 'Use separate keys for applications. Set model limits, expiry and quota in the console, then check the models visible to that key before sending a request.',
        code: 'curl {{origin}}/v1/models -H "Authorization: Bearer $NEW_API_KEY"',
      },
    ],
  },
  'choose-route': {
    title: 'Choose a route',
    intro: 'Choose a model for the task, a route for access, and an API key for your application.',
    sections: [
      {
        title: 'Choose a route',
        text: 'Compare routes for the same model. First check the protocol and capabilities your application needs, then compare reliability, latency, output speed and price.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Performance',
        text: 'Success rate and recent history describe observed calls, not a guarantee. Check the sample size; missing measurements are not zero. First-token latency measures response start, while output speed measures streaming generation.',
        metrics: [
          {
            name: 'Success rate',
            description: 'The proportion of observed requests that succeeded. Consider the sample size and recent history.',
          },
          {
            name: 'Time to first token',
            description: 'Time until output begins. A shorter delay makes the first response appear sooner.',
          },
          {
            name: 'Output speed',
            description: 'Tokens generated per second during streaming. This is not a character count.',
          },
          {
            name: 'Price',
            description: 'Compare input, output and cache charges using the same units and the selected route.',
          },
        ],
      },
      {
        title: 'Price',
        text: 'Compare input, output and cache prices using the same units. For image and video tasks, check whether charges depend on requests, images, duration or other parameters. Actual cost depends on your usage.',
      },
      {
        title: 'API keys',
        text: 'Create or choose an API key for the selected group. Changing only the model ID does not change the key group. Changing a key group affects every application using that key.',
        link: { href: '/keys', label: 'Manage API keys' },
      },
    ],
  },
  'async-tasks': {
    title: 'Connect asynchronous tasks',
    intro: 'Submit a task, keep its ID, check its status, then retrieve the completed result.',
    sections: [
      {
        title: 'Connection settings',
        text: 'Choose an available task model and read its model documentation. Plugin-native routes, video and background Responses have different request shapes; use the protocol supported by your route.',
      },
      {
        title: 'Send a request',
        text: 'For a plugin supporting background Responses, submit with background enabled and retain the returned response ID. Video jobs use their own create endpoint and task ID. These examples are not executed by this page.',
        code: `curl {{origin}}/v1/responses -H "Authorization: Bearer $NEW_API_KEY" -H "Content-Type: application/json" -d '{"model":"your-model","input":"Your task","background":true}'`,
      },
      {
        title: 'Verify the result',
        text: 'Query the matching retrieval endpoint with the same API key. Wait for a terminal status before downloading results; handle failed or cancelled tasks and avoid repeated submissions. Check task logs for failure details.',
        code: 'curl {{origin}}/v1/responses/RESPONSE_ID -H "Authorization: Bearer $NEW_API_KEY"',
      },
      {
        title: 'Video generation',
        text: 'For a route supporting the OpenAI video protocol, replace the model and prompt, submit once, and save the returned id. Request parameters and availability depend on the selected model and route.',
        code: 'curl {{origin}}/v1/videos -H "Authorization: Bearer $NEW_API_KEY" -F "model=your-video-model" -F "prompt=A quiet mountain lake" -F "seconds=5"',
      },
      {
        title: 'Video result',
        text: 'Use the returned video id and the same API key to check its status. Download the content only after the task completes. Replace TASK_ID before running these examples.',
        code: 'curl {{origin}}/v1/videos/TASK_ID -H "Authorization: Bearer $NEW_API_KEY"',
      },
      {
        title: 'Download',
        text: 'Once the video task is complete, replace TASK_ID and download the content with the same API key.',
        code: 'curl {{origin}}/v1/videos/TASK_ID/content -H "Authorization: Bearer $NEW_API_KEY" -o result.mp4',
      },
    ],
  },
  'video-generation': {
    title: 'Video generation',
    intro: 'Create, track and download asynchronous video tasks.',
    sections: [
      {
        title: 'Connection settings',
        text: 'Available protocols depend on each model and channel configuration.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      videoRouteSelection,
      {
        title: 'Video generation',
        text: 'Create, track and download asynchronous video tasks.',
        code: `curl {{origin}}/v1/videos \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"table-seedance-2-5","prompt":"A quiet mountain lake","seconds":5,"size":"1280x720"}'`,
      },
      {
        title: 'Response',
        text: 'A successful submission returns a task id, not a finished video. This response is an illustration; fields may vary by route.',
        code: '{\n  "id": "task_example_123",\n  "object": "video",\n  "model": "table-seedance-2-5",\n  "status": "queued",\n  "progress": 0\n}',
      },
      {
        title: 'Video result',
        text: 'Save the returned id. Query it with an authorized API key; queued and in_progress mean wait, completed means download, failed means stop. Response fields can vary by route.',
        code: 'curl {{origin}}/v1/videos/TASK_ID -H "Authorization: Bearer $NEW_API_KEY"',
      },
      {
        title: 'Download',
        text: 'Download completed video content with an authorized API key. Content type and availability depend on the route; save results promptly.',
        code: 'curl {{origin}}/v1/videos/TASK_ID/content -H "Authorization: Bearer $NEW_API_KEY" -o result.mp4',
      },
      {
        title: 'Attachments',
        text: 'Available protocols depend on each model and channel configuration.',
        code: `curl {{origin}}/v1/videos \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  -F 'model=table-seedance-2-5' \\\n  -F 'prompt=Animate the reference image' \\\n  -F 'seconds=5' \\\n  -F 'input_reference=@reference.png'`,
        link: { href: '/documents/eva-video-api-v1.1.md', label: 'Download' },
      },
      {
        title: 'Create upload',
        text: 'Use the same account API key as the video task. Create an upload with a file name, media_type (image, video or audio), matching MIME type without parameters, size in bytes and the whole file SHA-256 as 64 lowercase hex characters. Save upload.id and chunk_size. The hash and size below are examples only.',
        code: `curl {{origin}}/v1/video/uploads \\\n  -H "Authorization: Bearer $NEW_API_KEY" -H "Content-Type: application/json" \\\n  -d '{"name":"reference.png","media_type":"image","mime_type":"image/png","size":3,"sha256":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}'`,
      },
      {
        title: 'Upload chunks',
        text: 'Split the file into 8 MiB chunks using the returned chunk_size, indexed from zero. Only the final chunk may be smaller. Send each chunk as binary with its own lowercase SHA-256. Identical chunk retries are accepted; different bytes for the same index conflict.',
        code: `curl -X PUT {{origin}}/v1/video/uploads/UPLOAD_ID/chunks/INDEX \\\n  -H "Authorization: Bearer $NEW_API_KEY" -H "Content-Type: application/octet-stream" \\\n  -H "X-Chunk-SHA256: CHUNK_SHA256" --data-binary @CHUNK_FILE`,
      },
      {
        title: 'Complete upload',
        text: 'Complete after uploading every chunk. The server verifies the full file hash; use the ID only after upload.ready is true. GET and DELETE /v1/video/uploads/UPLOAD_ID query or delete it. Uploads expire 24 hours after creation.',
        code: 'curl -X POST {{origin}}/v1/video/uploads/UPLOAD_ID/complete -H "Authorization: Bearer $NEW_API_KEY"',
      },
      {
        title: 'Use uploaded references',
        text: 'Available protocols depend on each model and channel configuration.',
        code: `curl {{origin}}/v1/videos \\\n  -H "Authorization: Bearer $NEW_API_KEY" -H "Content-Type: application/json" \\\n  -d '{"model":"table-seedance-2-5","prompt":"Animate the references","seconds":5,"image_upload_ids":["IMAGE_UPLOAD_ID"],"video_upload_ids":["VIDEO_UPLOAD_ID"],"audio_upload_ids":["AUDIO_UPLOAD_ID"]}'`,
      },
      {
        title: 'Price',
        text: 'Rates vary by route: per-second routes use the valid requested duration and per-video routes charge per task. Group discounts and final billing follow the account and selected route.',
      },
      {
        title: 'Errors',
        text: 'If submission times out before an id is returned, the upstream may still have accepted the task. Do not blindly resubmit; record the time and contact the administrator. Follow rate-limit responses when polling.',
        link: { href: '/docs/errors', label: 'Errors' },
      },
      {
        title: 'Authentication',
        text: 'Use your eva API key on your server. Do not put keys, private media URLs or signed output URLs in public code or logs.',
      },
    ],
  },
  authentication: {
    title: 'Authentication',
    intro: 'Model APIs and console sessions use different credentials.',
    sections: [
      {
        title: 'API keys',
        text: 'Use a model API key for model requests. A console session token is not a model API key.',
        code: 'Authorization: Bearer sk-YOUR_API_KEY',
      },
      {
        title: 'Sessions',
        text: 'The console uses the native New API login and refresh flow. The refresh credential uses an HttpOnly cookie; the short-lived access token stays in memory.',
      },
      {
        title: 'Permissions',
        text: 'The server checks resource ownership, account permissions and model groups on each request. Hidden navigation does not grant API access.',
      },
    ],
  },
  errors: {
    title: 'Errors',
    intro: 'Use the response status and message to diagnose a failed request.',
    sections: [
      {
        title: '400',
        text: 'Check the request body, model ID and parameters against the protocol and the selected route. The response message may identify the invalid field.',
        link: { href: '/docs/api', label: 'API reference' },
      },
      {
        title: '401',
        text: 'Check whether the model API key is valid, enabled and unexpired. Sign in again if your console session has expired.',
      },
      {
        title: '403',
        text: 'Check account permissions, token scopes and ownership of the requested resource.',
      },
      {
        title: '404',
        text: 'Check the complete request path, HTTP method and the selected protocol. For asynchronous tasks, also verify the task ID.',
        link: { href: '/docs/async-tasks', label: 'Connect asynchronous tasks' },
      },
      {
        title: '429',
        text: 'Check rate limits and quota. Follow the server response and wait before retrying.',
      },
      {
        title: '5xx',
        text: 'Check service status and request logs for the failure. For an asynchronous request, check its task status before submitting again to avoid duplicate work.',
        link: { href: '/usage-logs/task', label: 'Task logs' },
      },
      {
        title: 'Model unavailable',
        text: 'Check the model ID, key group and channel configuration. No measurements means no samples are available.',
      },
      {
        title: 'Stream interrupted',
        text: 'Check client cancellation, proxy buffering and timeouts. Avoid replaying a request that may already have incurred usage.',
      },
    ],
  },
  api: {
    title: 'API reference',
    intro: 'Available protocols depend on each model and channel configuration.',
    sections: [
      {
        title: 'Connection settings',
        text: 'Set your API key in an environment variable. Copy the model ID from the catalog and select a key for its route. Running the examples sends real requests and may incur charges.',
        code: "export NEW_API_KEY='YOUR_API_KEY'",
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Models',
        text: 'Query the models visible to your API key.',
        code: 'curl {{origin}}/v1/models -H "Authorization: Bearer $NEW_API_KEY"',
      },
      {
        title: 'Text generation',
        text: 'Send a POST request with model and messages. Set stream to true for server-sent events. Optional parameters such as temperature and max_tokens depend on the selected model.',
        code: `curl {{origin}}/v1/chat/completions \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"your-text-model","messages":[{"role":"user","content":"Hello!"}],"stream":false}'`,
      },
      {
        title: 'Text response',
        text: 'The following is an example response. Read the generated text from choices[0].message.content; usage reports token counts when provided.',
        code: `{
  "id": "chatcmpl_example",
  "object": "chat.completion",
  "model": "your-text-model",
  "choices": [
    {"index": 0, "message": {"role": "assistant", "content": "Hello!"}, "finish_reason": "stop"}
  ],
  "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
}`,
      },
      {
        title: 'Image generation',
        text: 'Send a POST request with model and prompt. n specifies the requested image count; size and quality depend on the selected model and route.',
        code: `curl {{origin}}/v1/images/generations \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"your-image-model","prompt":"A quiet mountain lake at sunrise","n":1}'`,
      },
      {
        title: 'Image response',
        text: 'The following is an example response. Images are returned in data; depending on the model, an item may contain url or b64_json.',
        code: `{
  "created": 1730000000,
  "data": [{"url": "https://example.com/generated-image.png"}]
}`,
      },
    ],
  },
}
export const toolNames: Record<string, string> = {
  'claude-code': 'Claude Code',
  claudecode: 'Claude Code',
  cursor: 'Cursor',
  codex: 'Codex CLI',
  'codex-cli': 'Codex CLI',
  workbuddy: 'WorkBuddy',
  'deepseek-harness': 'DeepSeek Harness',
  cline: 'Cline',
  'roo-code': 'Roo Code',
  'kilo-code': 'Kilo Code',
  windsurf: 'Windsurf',
  trae: 'Trae',
  'cherry-studio': 'Cherry Studio',
  lobehub: 'LobeHub',
  'open-webui': 'Open WebUI',
  dify: 'Dify',
  coze: 'Coze',
  n8n: 'n8n',
  langchain: 'LangChain',
  github: 'GitHub',
  'cc-switch': 'CC Switch',
  'cc-switch-aggregation': 'CC Switch aggregation',
}

export const toolGuides: Record<string, Guide> = {
  cursor: {
    title: 'Cursor',
    intro: 'Configure Cursor to use your own model API key.',
    source: 'https://cursor.com/help/models-and-usage/api-keys',
    sections: [
      {
        title: 'Connection settings',
        text: 'Open Cursor Settings and Models, then configure the OpenAI API key. If your Cursor version offers an OpenAI base URL override, enter this gateway address and verify the provider settings before saving.',
        code: 'OpenAI Base URL: {{origin}}/v1\nAPI Key: <your eva API key>',
      },
      {
        title: 'Choose a model',
        text: 'Select a model available to the API key. Custom keys apply to supported chat models; Cursor features that use specialized models may not use your key.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Security',
        text: 'Cursor routes requests through its servers and sends your API key with each request. Review Cursor privacy and data handling before connecting.',
      },
      {
        title: 'Verify the result',
        text: 'Check request logs after your first request to confirm the model and usage.',
        link: { href: '/usage-logs/common', label: 'Usage logs' },
      },
    ],
  },
  'cc-switch-aggregation': {
    title: 'CC Switch aggregation',
    intro: 'Use models from multiple providers in CC Switch aggregation mode.',
    source: 'https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/zh/4-proxy/4.6-aggregation.md',
    sections: [
      {
        title: 'Connection settings',
        text: 'Configure each provider and its model list for Claude Code or Codex separately. Add providers to the aggregation list, select a default provider, then confirm the switch to aggregation mode.',
        link: { href: '/docs/cc-switch', label: 'CC Switch' },
      },
      {
        title: 'Models',
        text: 'Aggregation requires CC Switch to stay running and does not provide automatic failover. Select models in the client; requests without a provider prefix go to the default provider. Each gateway key remains limited by its group and model permissions.',
      },
      {
        title: 'Verify the result',
        text: 'After model list changes, follow the CC Switch instructions to refresh the client. Restarting the Codex daemon may interrupt other tasks. Send a test request only when ready and check the usage logs.',
        link: { href: '/usage-logs/common', label: 'Usage logs' },
      },
    ],
  },
  'cc-switch': {
    title: 'CC Switch',
    intro: 'Connect a selected model route to CC Switch.',
    source: 'https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/2-providers/2.1-add.md',
    sections: [
      {
        title: 'Choose a model',
        text: 'For Codex CLI choose a route supporting Responses; for Claude Code choose a route supporting Anthropic Messages. Create or select an enabled key for the selected group.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Connection settings',
        text: 'On the model connection page choose the client, select a key, confirm sharing and complete verification. Open CC Switch and review the provider before confirming import. The imported provider may become active; check the client configuration.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Security',
        text: 'The import link contains your API key. Do not share it. If it is exposed, disable the key and create a replacement.',
        link: { href: '/keys', label: 'Manage API keys' },
      },
      {
        title: 'Verify the result',
        text: 'Check request logs after your first request to confirm the model and usage.',
        link: { href: '/usage-logs/common', label: 'Usage logs' },
      },
      {
        title: 'CC Switch aggregation',
        text: 'Use models from multiple providers in CC Switch aggregation mode.',
        link: { href: '/docs/cc-switch-aggregation', label: 'CC Switch aggregation' },
      },
    ],
  },
  'deepseek-harness': {
    title: 'DeepSeek Harness',
    intro: 'Connect DeepSeek Harness to this gateway using a custom model API.',
    source: 'https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md',
    sections: [
      {
        title: 'Connection settings',
        text: 'In Settings and Models, add a custom model API. Choose the protocol supported by your route, set the gateway address and credential, and add the exact model ID.',
        code: 'Provider ID: eva\nBase URL: {{origin}}/v1\nAPI protocol: openai-completions\nCredential: <your eva API key>\nModel ID: <your model ID>',
      },
      {
        title: 'Choose a model',
        text: 'Choose a model that supports Chat Completions and the tools your workflow needs. Configure its context window and other capabilities to match the model.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Search',
        text: 'DeepSeek native web search has its own endpoint and credentials; it does not automatically follow the chat gateway. Check its destination and credential before use. If you do not intend to send your gateway key there, disable that search provider or use separate credentials.',
        link: {
          href: 'https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/web/web-search-deepseek/README.md',
          label: 'Official documentation',
        },
      },
      {
        title: 'Verify the result',
        text: 'Check the gateway request logs after the example runs. Review the model, key group and balance if the request fails.',
        link: { href: '/usage-logs/common', label: 'Usage logs' },
      },
    ],
  },
  workbuddy: {
    title: 'WorkBuddy',
    intro: 'Connect WorkBuddy to this gateway with a custom model.',
    source: 'https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model',
    sections: [
      {
        title: 'Connection settings',
        text: 'In WorkBuddy model settings, add a Custom model. Enable custom protocol to use the complete endpoint below; enter your API key and exact model ID.',
        code: 'URL: {{origin}}/v1/chat/completions\nAPI Key: <your eva API key>\nModel: <your model ID>',
      },
      {
        title: 'Choose a model',
        text: 'Choose a model that supports Chat Completions and the tools your workflow needs. Configure its context window and other capabilities to match the model.',
        link: { href: '/pricing', label: 'Browse all models' },
      },
      {
        title: 'Verify the result',
        text: 'Start a new task with the saved custom model and check usage logs after a test request. A text reply alone does not verify file tools; test those separately in a suitable workspace.',
        link: { href: '/usage-logs/common', label: 'Usage logs' },
      },
    ],
  },
  'claude-code': {
    title: 'Claude Code',
    intro: 'Configure Claude Code to use an Anthropic-compatible route on this gateway.',
    source: 'https://code.claude.com/docs/en/env-vars',
    sections: [
      {
        title: 'Connection settings',
        text: 'Set these environment variables before starting Claude Code. Use the gateway address without /v1, and supply your API key as ANTHROPIC_AUTH_TOKEN.',
        code: 'ANTHROPIC_BASE_URL={{origin}}\nANTHROPIC_AUTH_TOKEN=<your eva API key>\nANTHROPIC_MODEL=<your model ID>',
      },
      {
        title: 'Choose a model',
        text: 'Choose a model whose route supports Anthropic Messages and the tools your workflow needs. Copy the exact model ID from the catalog.',
      },
      {
        title: 'Verify the result',
        text: 'Start Claude Code with those settings and check the request logs after a test request. Client versions and model capabilities can affect tool behavior.',
      },
    ],
  },
  cline: {
    title: 'Cline',
    intro: 'Connect Cline using its OpenAI Compatible provider.',
    source: 'https://docs.cline.bot/provider-config/openai-compatible',
    sections: [
      {
        title: 'Connection settings',
        text: 'Open Cline settings, select OpenAI Compatible, and enter the Base URL, API key and exact model ID below.',
        code: 'Base URL: {{origin}}/v1\nAPI Key: <your eva API key>\nModel ID: <your model ID>',
      },
      {
        title: 'Choose a model',
        text: 'Choose a model that supports Chat Completions and the tools your workflow needs. Configure its context window and other capabilities to match the model.',
      },
      {
        title: 'Verify the result',
        text: 'Save the settings and check the request logs after a test request. Cline versions and model capabilities can affect tool behavior.',
      },
    ],
  },
  'open-webui': {
    title: 'Open WebUI',
    intro: 'Add this gateway as an OpenAI-compatible connection in Open WebUI.',
    source: 'https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/starting-with-openai-compatible/',
    sections: [
      {
        title: 'Connection settings',
        text: 'In Open WebUI, open Settings, Admin, Connections and add an OpenAI API connection. Enter the URL and your API key, then verify and save.',
        code: 'URL: {{origin}}/v1\nAPI Key: <your eva API key>',
      },
      {
        title: 'Choose a model',
        text: 'Select a model available to the API key. If Open WebUI runs in a container, the gateway address must be reachable from that container.',
      },
      {
        title: 'Verify the result',
        text: 'Send a test message and check the gateway request logs. The selected model and route must support Chat Completions.',
      },
    ],
  },
  'roo-code': {
    title: 'Roo Code',
    intro: 'Connect Roo Code using its OpenAI Compatible provider.',
    source: 'https://docs.roocode.com/providers/openai-compatible',
    sections: [
      {
        title: 'Connection settings',
        text: 'Open Roo Code settings, select OpenAI Compatible, and enter the Base URL, API key and exact model ID below.',
        code: 'Base URL: {{origin}}/v1\nAPI Key: <your eva API key>\nModel ID: <your model ID>',
      },
      {
        title: 'Choose a model',
        text: 'Roo Code requires native OpenAI-compatible tool calling. Choose a route and model that support it, and set the model context window accurately.',
      },
      {
        title: 'Verify the result',
        text: 'Save the settings and check the request logs after a test request. Client versions and model capabilities can affect tool behavior.',
      },
    ],
  },
  'cherry-studio': {
    title: 'Cherry Studio',
    intro: 'Add this gateway as a custom OpenAI provider in Cherry Studio.',
    source: 'https://docs.cherry-ai.com/cherry-studio-wen-dang/en-us/pre-basic/providers/zi-ding-yi-fu-wu-shang',
    sections: [
      {
        title: 'Connection settings',
        text: 'In Cherry Studio settings, add a custom model provider of type OpenAI. Enter the gateway address and your API key, then enable the provider.',
        code: 'API Address: {{origin}}\nAPI Key: <your eva API key>',
      },
      {
        title: 'Choose a model',
        text: 'Use Manage to add an available model, or enter its exact model ID manually. Check the selected model supports Chat Completions.',
      },
      {
        title: 'Verify the result',
        text: 'Check the connection, select the enabled provider and model, then review the gateway logs after a test request.',
      },
    ],
  },
  'codex-cli': {
    title: 'Codex CLI',
    intro: 'Configure Codex CLI with a Responses-compatible gateway provider.',
    source: 'https://learn.chatgpt.com/docs/config-file/config-advanced',
    sections: [
      {
        title: 'Connection settings',
        text: 'Save these settings in ~/.codex/eva.config.toml. Set NEW_API_KEY in your environment and replace your-model with the exact model ID. Codex 0.134.0 or later is required for this profile file.',
        code: 'model = "your-model"\nmodel_provider = "eva"\n\n[model_providers.eva]\nname = "eva"\nbase_url = "{{origin}}/v1"\nenv_key = "NEW_API_KEY"\nwire_api = "responses"\nsupports_websockets = false',
      },
      {
        title: 'Choose a model',
        text: 'Select a model and route that support Responses and the tool features your workflow needs. A compatible endpoint alone does not guarantee every Codex feature.',
      },
      {
        title: 'Verify the result',
        text: 'Start a new Codex session and check the gateway request logs after a test request. Configuration and model support depend on the installed version.',
        code: 'codex --profile eva',
      },
    ],
  },
  dify: {
    title: 'Dify',
    intro: 'Call this gateway from a Dify workflow using an HTTP Request node.',
    source: 'https://docs.dify.ai/en/cloud/use-dify/nodes/http-request',
    sections: [
      {
        title: 'Connection settings',
        text: 'Add an HTTP Request node to the workflow. Set the method to POST, choose Bearer authentication with your API key, and use a JSON request body.',
        code: 'POST {{origin}}/v1/chat/completions\n\n{"model":"your-model","messages":[{"role":"user","content":"Hello!"}]}',
      },
      {
        title: 'Choose a model',
        text: 'Replace your-model with an available model ID whose route supports Chat Completions. Keep credentials in Dify rather than in shared workflow text.',
      },
      {
        title: 'Verify the result',
        text: 'Run the node only when you are ready to send a real request. Inspect the response and gateway logs, then map the result to the next workflow node.',
      },
    ],
  },
  n8n: {
    title: 'n8n',
    intro: 'Call this gateway from an n8n workflow using an HTTP Request node.',
    source: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest',
    sections: [
      {
        title: 'Connection settings',
        text: 'Add an HTTP Request node. Set POST, configure Bearer authentication with your API key, enable Send Body and select JSON.',
        code: 'POST {{origin}}/v1/chat/completions\n\n{"model":"your-model","messages":[{"role":"user","content":"Hello!"}]}',
      },
      {
        title: 'Choose a model',
        text: 'Replace your-model with an available model ID whose route supports Chat Completions. Keep the API key in n8n credentials rather than in shared workflow text.',
      },
      {
        title: 'Verify the result',
        text: 'Run the node only when you are ready to send a real request. Inspect the response and gateway logs, then map the result to the next workflow node.',
      },
    ],
  },
  langchain: {
    title: 'LangChain',
    intro: 'Use LangChain ChatOpenAI with this gateway and an API key.',
    source: 'https://docs.langchain.com/oss/python/integrations/chat/openai',
    sections: [
      {
        title: 'Connection settings',
        text: 'Install langchain-openai, set EVA_API_KEY in your environment, and replace your-model with an available model ID. Running the example sends a real request.',
        code: 'import os\nfrom langchain_openai import ChatOpenAI\n\nmodel = ChatOpenAI(\n    model="your-model",\n    base_url="{{origin}}/v1",\n    api_key=os.environ["EVA_API_KEY"],\n)\nprint(model.invoke("Hello!").content)',
      },
      {
        title: 'Choose a model',
        text: 'Choose a model and route that support Chat Completions. Additional features depend on the model, route and installed LangChain version.',
      },
      {
        title: 'Verify the result',
        text: 'Check the gateway request logs after the example runs. Review the model, key group and balance if the request fails.',
      },
    ],
  },
  'kilo-code': {
    title: 'Kilo Code',
    intro: 'Add this gateway as a custom OpenAI-compatible provider in Kilo Code.',
    source: 'https://kilo.ai/docs/ai-providers/openai-compatible',
    sections: [
      {
        title: 'Connection settings',
        text: 'In Kilo Code settings, open Providers and add a custom provider. Select OpenAI Compatible, then enter the Base URL and API key.',
        code: 'Base URL: {{origin}}/v1\nAPI Key: <your eva API key>',
      },
      {
        title: 'Choose a model',
        text: 'Choose a model from the detected list or enter its exact ID manually. Match its context window and tool capabilities to the selected model.',
      },
      {
        title: 'Verify the result',
        text: 'Save the provider and check the gateway request logs after a test request. Client versions and model capabilities can affect tool behavior.',
      },
    ],
  },
  lobehub: {
    title: 'LobeHub',
    intro: 'Connect LobeHub to this gateway using an OpenAI-compatible provider.',
    source: 'https://github.com/lobehub/lobehub',
    sections: [
      {
        title: 'Connection settings',
        text: 'In LobeHub model provider settings, configure an OpenAI-compatible provider with the gateway address and your API key. Settings and supported options vary by version.',
        code: 'API Proxy URL: {{origin}}/v1\nAPI Key: <your eva API key>',
      },
      {
        title: 'Choose a model',
        text: 'Select or add an available model using the exact model ID. Make sure the model and route support Chat Completions.',
      },
      {
        title: 'Verify the result',
        text: 'Check the connection and review the gateway request logs after a test message. The gateway must be reachable from the LobeHub instance.',
      },
    ],
  },
}
