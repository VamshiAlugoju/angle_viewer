export type Tick = Record<string, string> & { subscription_mode: string; token: string; last_traded_price: string }

export interface FeedSubscription {
  exchangeType: number
  tokens: string[]
  mode?: 1 | 2 | 3 | 4 // LTP | Quote | SnapQuote | Depth
}

export function connectLiveFeed(onTick: (tick: Tick) => void, onStatus?: (status: string) => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const socket = new WebSocket(`${protocol}://${window.location.host}/ws-feed`)

  socket.onopen = () => onStatus?.('connected')
  socket.onclose = () => onStatus?.('disconnected')
  socket.onerror = () => onStatus?.('error')

  socket.onmessage = (evt) => {
    const msg = JSON.parse(evt.data)
    if (msg.type === 'tick') onTick(msg.data)
    if (msg.type === 'error') onStatus?.(`error: ${msg.message}`)
  }

  return {
    subscribe(sub: FeedSubscription) {
      const send = () =>
        socket.send(
          JSON.stringify({
            action: 'subscribe',
            mode: sub.mode ?? 1,
            exchangeType: sub.exchangeType,
            tokens: sub.tokens,
          })
        )
      if (socket.readyState === WebSocket.OPEN) send()
      else socket.addEventListener('open', send, { once: true })
    },
    unsubscribe(sub: FeedSubscription) {
      socket.send(
        JSON.stringify({
          action: 'unsubscribe',
          mode: sub.mode ?? 1,
          exchangeType: sub.exchangeType,
          tokens: sub.tokens,
        })
      )
    },
    close() {
      socket.close()
    },
  }
}
