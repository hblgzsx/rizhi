export const SOCIAL_SOURCES = [
  {id:'douyin',name:'抖音',mark:'抖',tone:'ink',url:'https://www.douyin.com/',description:'社会现场、行业见闻、短视频',domains:['douyin.com','iesdouyin.com']},
  {id:'weibo',name:'微博',mark:'微',tone:'coral',url:'https://weibo.com/',description:'公共事件、热点讨论、当事人动态',domains:['weibo.com','weibo.cn']},
  {id:'bilibili',name:'B 站',mark:'B',tone:'blue',url:'https://www.bilibili.com/',description:'技术课程、科普长视频、深度讲解',domains:['bilibili.com','b23.tv']},
  {id:'xiaohongshu',name:'小红书',mark:'小',tone:'rose',url:'https://www.xiaohongshu.com/',description:'生活经验、职业观察、普通人的故事',domains:['xiaohongshu.com','xhslink.com','rednote.com']},
  {id:'zhihu',name:'知乎',mark:'知',tone:'blue',url:'https://www.zhihu.com/',description:'问题讨论、行业经验、不同观点',domains:['zhihu.com','zhihu.com.cn']},
  {id:'toutiao',name:'今日头条',mark:'头',tone:'coral',url:'https://www.toutiao.com/',description:'综合资讯、社会热点、多元解读',domains:['toutiao.com','toutiaoimg.com']},
  {id:'wechat',name:'微信公众号',mark:'信',tone:'green',url:'https://mp.weixin.qq.com/',description:'专栏文章、行业分析、持续关注的作者',domains:['mp.weixin.qq.com']},
];
export function detectPlatform(value) {
  try {
    const url=new URL(value);if(!['https:','http:'].includes(url.protocol))return '';
    const host=url.hostname.toLowerCase();
    return SOCIAL_SOURCES.find(source=>source.domains.some(domain=>host===domain||host.endsWith('.'+domain)))?.name || '';
  }catch{return '';}
}
export function extractSharedLink(value) {
  const matches=String(value).match(/https?:\/\/[^\s<>"'「」『』【】]+/gi)||[];
  for(const match of matches){
    const trimmed=match.replace(/[，。；、！？）》）\])}]+$/g,'');
    try{const url=new URL(trimmed);if(url.username||url.password)continue;return {url:url.href,platform:detectPlatform(url.href)};}catch{}
  }
  return null;
}
