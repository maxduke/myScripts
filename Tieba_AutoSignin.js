/*
cron "11 8,9 * * *" Tieba_AUtoSignin.js, tag=Tieba签到
*/

const axios = require('axios')
const { getEnv } = require('./qlApi.js')
const notify = require('./sendNotify')

//签到列表
function signTieBa(bduss, remarks) {
  const sendMessage = [remarks]
  return axios("https://tieba.baidu.com/mo/q/newmoindex", {
    method: 'GET',
    headers: {
      "Content-Type": "application/octet-stream",
      Referer: "https://tieba.baidu.com/index/tbwise/forum",
      Cookie: `BDUSS=${bduss}`,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/16A366"
    }
  })
    .then(d => d.data)
    .then(async body => {
      let isSuccessResponse = body && body.no == 0 && body.error == "success" && body.data.tbs;
      if (!isSuccessResponse) {
        sendMessage.push('签到失败', (body && body.error) ? body.error : "接口数据获取失败")
        return Promise.reject(sendMessage.join('\n'))
      }

      if (body.data.like_forum && body.data.like_forum.length > 0) {
        for await (bar of body.data.like_forum) {
          if (bar.is_sign == 1) {
            sendMessage.push(
              `[${bar.forum_name}]已签到: 等级 ${bar.user_level}, 经验 ${bar.user_exp}`
            )
          } else {
            try {
              const addResult = await signBar(bar, body.data.tbs, bduss)
              sendMessage.push(
                `[${bar.forum_name}]签到成功: 获得 ${addResult.data.uinfo.cont_sign_num} 积分, 第 ${addResult.data.uinfo.user_sign_rank} 个签到`
              )
            } catch (e) {
              sendMessage.push(`${bar.forum_name}签到失败:`, e)
            }
          }
        }
      } else {
        sendMessage.push('签到失败', "请确认您有关注的贴吧")
        return Promise.reject(sendMessage.join('\n'))
      }

      return sendMessage.join('\n')
    })
    .catch(e => {
      sendMessage.push('签到失败')
      sendMessage.push(e.message)
      return Promise.reject(sendMessage.join('\n'))
    })
}

// signBar
function signBar(bar, tbs, bduss) {
  if (bar.is_sign != 1) { //未签到
    // 创建一个新的FormData实例
    var formData = new FormData();    
    // 添加键值对
    formData.append('tbs', tbs)
    formData.append('kw', bar.forum_name)
    formData.append('ie', 'utf-8')
    return axios("https://tieba.baidu.com/sign/add", {
      method: 'POST',
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: `BDUSS=${bduss}`,
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 10_1_1 like Mac OS X; zh-CN) AppleWebKit/537.51.1 (KHTML, like Gecko) Mobile/14B100 UCBrowser/10.7.5.650 Mobile"
      },
      data: formData
    })
      .then(d => d.data)
      .then(json => {
        return json
      })
  }  
}

// 获取环境变量
async function getBDUSS() {
  let bduss = process.env.BDUSS || []
  let bdussArray = []

  if (Array.isArray(bduss)) bdussArray = bduss
  else if (bduss.indexOf('&') > -1)
    bdussArray = bduss.split('&')
  else if (bduss.indexOf('\n') > -1)
    bdussArray = bduss.split('\n')
  else bdussArray = [bduss]

  if (!bdussArray.length) {
    console.log('未获取到BDUSS, 程序终止')
    process.exit(1)
  }

  return {
    bdussArray
  }
}

!(async () => {
  const { bdussArray } = await getBDUSS()

  const message = []
  let index = 1
  for await (bduss of bdussArray) {
    let remarks = bduss.remarks || `账号${index}`
    try {
      const sendMessage = await signTieBa(bduss, remarks)
      console.log(sendMessage)
      console.log('\n')
      message.push(sendMessage)
    } catch (e) {
      console.log(e)
      console.log('\n')
      message.push(e)
    }
    index++
  }
  await notify.sendNotify(`Tieba签到`, message.join('\n'))
})()
