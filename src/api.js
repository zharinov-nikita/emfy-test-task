export const BASE_URL_API = `https://nikitanzt48.amocrm.ru/api/v4`

export const TOKEN_TYPE = "Bearer"
export const TOKEN =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjUyYTY2ZDk3MWJjOTljNTVhOGE3ZDY4ZjBiMjEzODBjYTZkNDAyNTBkNTcxNGMzMWRmNzkwZTQxZDc4ODFkMjJiM2RlNjQ5OGM4MTBkNzhlIn0.eyJhdWQiOiI0NTE1YjIxMS01N2Y4LTRmYTAtODM2MS00ZWM4OTYxZmI3OWYiLCJqdGkiOiI1MmE2NmQ5NzFiYzk5YzU1YThhN2Q2OGYwYjIxMzgwY2E2ZDQwMjUwZDU3MTRjMzFkZjc5MGU0MWQ3ODgxZDIyYjNkZTY0OThjODEwZDc4ZSIsImlhdCI6MTc0Mzc0MjU4OCwibmJmIjoxNzQzNzQyNTg4LCJleHAiOjE3NjE4Njg4MDAsInN1YiI6IjEyMzI4NjgyIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMyMzMyMzI2LCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiODA5OWE2NzEtZGY3OC00YTA2LTgwNjAtMzNiZTM4OTkwNzgyIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.j9Jhaj6vH31mHuRP42xwMVY2-Tfa2CIoE1W-PTR1BVtvLrqcKXZOJ4ybASPxnDKy_qaKA3uwg6E90HkS9-Z1loZupfQBfPweHEg9dM1snMKv6cX1kjizVYt_1QtLxxSNUwavwhWFS---dU2B4F3MnsBPsnz7Rh-U1LwDF7ue8UNwUwhnvCWVjssjm8NJKKlqvg8pysg5H_JKmJZepqEyftN2gY9gA7yIEZ7ZAfqgLs8VmBRkwpiDrykFBlceARu2Lnc03DofDP8tzyUepUSR4WQzd7X-Fb3PMGh3O5-xfFvqmSOlxERFd722rUJmQiPi1TUu48Iy7FNQ9aTNsg8tFA"

// Глобальные переменные для ограничения запросов
let lastRequestTime = 0
let requestsInLastSecond = 0

export async function callApi({
  url = "GET",
  method,
  body,
  onSuccess,
  signal
}) {
  let data = undefined
  let error = null
  let isLoading = true

  try {
    // Ограничение: максимум 2 запроса в секунду
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime

    if (timeSinceLastRequest < 1000 && requestsInLastSecond >= 2) {
      const delay = 1000 - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, delay))
      requestsInLastSecond = 0
    }

    const response = await fetch(`${BASE_URL_API}/${url}`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `${TOKEN_TYPE} ${TOKEN}`
      },
      method,
      body: JSON.stringify(body),
      signal
    })
    lastRequestTime = Date.now()
    requestsInLastSecond++

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    data = await response.json()
    if (onSuccess) onSuccess(data)
  } catch (e) {
    error = e
  } finally {
    isLoading = false
  }

  return { data, error, isLoading }
}
