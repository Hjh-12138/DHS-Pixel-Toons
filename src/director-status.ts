/** Public failures are bounded codes; provider messages can contain private data. */
export const DIRECTOR_FAILURE_TEXT={
  'token-limit':'模型输出达到上限，未能生成完整场景',
  'empty-output':'模型没有返回场景正文',
  'invalid-json':'模型返回的场景 JSON 不完整',
  'invalid-scene':'场景未通过绘图校验',
  language:'场景说明未使用中文',
  'output-limit':'模型返回的场景内容过长',
  timeout:'动态场景生成超时',
  auth:'模型认证失败，请检查登录或 API 凭证',
  quota:'模型额度不足或请求过于频繁',
  'model-unavailable':'导演模型不可用，请检查模型配置',
  'request-failed':'模型请求失败，请稍后重试',
  'animation-error':'场景运行失败',
  connection:'动画服务连接失败',
} as const
export type DirectorFailureCode=keyof typeof DIRECTOR_FAILURE_TEXT
export class DirectorError extends Error {
  constructor(public readonly code:DirectorFailureCode,message=`Director ${code}`){super(message);this.name='DirectorError'}
}
export function directorFailure(error:unknown):DirectorFailureCode {
  if(error instanceof DirectorError)return error.code
  const e=error&&typeof error==='object'?error as Record<string,unknown>:{}
  const f=e.failure&&typeof e.failure==='object'?e.failure as Record<string,unknown>:e
  const code=String(e.code??f.code??'').toUpperCase(),status=f.status
  if(/TIMEOUT/.test(code))return 'timeout'
  if(status===401||status===403||/AUTH|SIGN_IN|TOKEN_INVALID|API_KEY/.test(code))return 'auth'
  if(status===429||/QUOTA|RATE_LIMIT/.test(code))return 'quota'
  if(/NO_ADAPTER|MODEL_NOT_FOUND|UNKNOWN_MODEL|UNSUPPORTED_REASONING_EFFORT|NO_CONFIGURED_MODEL/.test(code))return 'model-unavailable'
  return 'request-failed'
}
export function fallbackCaption(prefix:string,reason:unknown):string {
  return typeof reason==='string'&&Object.hasOwn(DIRECTOR_FAILURE_TEXT,reason)?`${prefix}：${DIRECTOR_FAILURE_TEXT[reason as DirectorFailureCode]}`:prefix
}
