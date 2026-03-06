/**
 * 飞书AI助手 - Cloudflare Workers 简化版
 */
const APP_ID = 'cli_a923fe15f53c9bc7';
const APP_SECRET = 'h3sepXWkyTYjYZgklxDaVhLo5ezR5YGx';

let cachedToken = null;
let tokenExpire = 0;

// 获取飞书Token
async function getTenantToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpire - 300000) {
    return cachedToken;
  }
  
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
  });
  
  const data = await response.json();
  
  if (data.code === 0) {
    cachedToken = data.tenant_access_token;
    tokenExpire = now + (data.expire || 7200) * 1000;
    return cachedToken;
  }
  return null;
}

// 回复消息
async function replyMessage(messageId, content) {
  const token = await getTenantToken();
  if (!token) return;
  
  await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msg_type: 'text',
      content: JSON.stringify({ text: content })
    })
  });
}

// AI处理
function processAI(message) {
  const msg = message.toLowerCase().trim();
  
  if (msg.includes('你好') || msg.includes('hello') || msg.includes('hi')) {
    return '你好！我是飞书AI助手，已成功连接！🎉\n\n告诉我你需要做什么？';
  }
  
  if (msg.includes('帮助') || msg.includes('help')) {
    return '🤖 我可以帮你：\n📝 回答问题\n📊 数据分析\n🌐 网页操作\n📄 文件处理\n💬 翻译文字\n\n直接告诉我！';
  }
  
  return `收到任务：「${message}」✅ 任务已记录！\n\n我是飞书AI助手，7×24小时运行中！`;
}

// 主入口
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 健康检查
    if (url.pathname === '/') {
      return new Response(JSON.stringify({ status: 'ok', service: '飞书AI助手' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const data = await request.json();
      
      // URL验证 - 立即返回
      if (data.type === 'url_verification') {
        return new Response(JSON.stringify({ challenge: data.challenge }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 处理消息
      const event = data.event || {};
      if (event.type === 'message') {
        const message = event.message || {};
        const messageId = message.message_id;
        
        const content = JSON.parse(message.content || '{}');
        const text = content.text || '';
        
        replyMessage(messageId, '🔄 收到任务，正在处理...');
        
        const response = processAI(text);
        replyMessage(messageId, response);
      }
      
      return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
