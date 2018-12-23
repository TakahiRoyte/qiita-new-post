const functions = require('firebase-functions')
const axios = require('axios')
const groupAccount = 'tdcsoft'
const qiitaApiBaseUrl = 'https://qiita.com/api/v2'
const teamsWebhookUrl = ''

exports.qiitaNewPost = functions.https.onRequest(async (request, response) => {
  // ユーザーリスト取得
  const users = await getUsers()

  // ユーザーリストに紐づく新着記事リスト取得
  const newPosts = await getUsersNewPosts(users)

  // 新規投稿がある場合、Teamsに投稿する
  if (newPosts.length) {
    await postNewPostsToTeams(newPosts)
  }
  response.send('Post Success')
})

// ユーザーリスト取得
async function getUsers() {
  try {
    const response = await axios.get(`${qiitaApiBaseUrl}/users/${groupAccount}/followees`)
    return response.data.map(user => user.id)
  } catch (error) {
    console.log(error)
  }
}

// ユーザーリストに紐づく新着記事リスト取得
async function getUsersNewPosts(users) {
  let newPosts = []

  for (let user of users) {
    // ユーザーに紐づく最新記事のデータを取得する
    const posts = await getUserNewPosts(user)
    newPosts = newPosts.concat(posts)
  }

  return newPosts
}

// ユーザー新規投稿記事リスト取得
async function getUserNewPosts(user) {
  const today = new Date()
  const checkDate = new Date(today.setDate(today.getDate() - 2))
  const checkDateStr = checkDate.toISOString().substr(0, 10)
  const response = await axios.get(
    `${qiitaApiBaseUrl}/items?query=user%3A${user}+created%3A>${checkDateStr}`
  )
  return response.data.map(post => {
    return {
      title: post.title,
      url: post.url,
      user: post.user.id,
      userImg: post.user.profile_image_url
    }
  })
}

// 新規投稿Teams投稿
async function postNewPostsToTeams(newPosts) {
  let postBody = []

  for (const post of newPosts) {
    postBody.push(generateColumnSet(post))
  }

  const requestBody = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '55C500',
    summary: 'Qiita新着投稿',
    sections: postBody,
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'TDC Organizationページを開く',
        targets: [
          {
            os: 'default',
            uri: 'https://qiita.com/organizations/tdc-soft'
          }
        ]
      }
    ]
  }

  try {
    const response = await axios.post(teamsWebhookUrl, requestBody)
    return response
  } catch (error) {
    console.log(error)
  }
}

// Teams用のカラムセットを返却する
function generateColumnSet(post) {
  return {
    activityTitle: `[${post.title}](${post.url})`,
    activitySubtitle: post.user,
    activityImage: post.userImg,
    markdown: true
  }
}
