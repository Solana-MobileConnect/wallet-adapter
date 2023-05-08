import { createQR, encodeURL, TransactionRequestURLFields } from '@solana/pay'
import { Transaction } from '@solana/web3.js'

export type TransactionState = {
  state: "init" | "requested" | "timeout" | "confirmed" | "finalized" | "aborted",
  err?: string | null,
  signature?: string,
  stateCallback?: any,
  sessionId: string
}


export default class MobileConnectClient {
  static pollingInterval = 2000

  loginCallback: (public_key: string) => void
  loginSessionId: string | undefined
  transactionSessions: { [index: string]: TransactionState }
  host: string
  cluster: string
  pollInterval: NodeJS.Timeout
  isPolling: boolean = false

  constructor(host: string, cluster: string) {

    if (host === undefined) throw new Error("No host provided")

    if (cluster === undefined) throw new Error("No cluster provided")

    this.host = host

    this.cluster = cluster

    this.loginCallback = x => { }

    this.transactionSessions = {}

    this.pollInterval = setInterval(() => this.poll().then(null, console.error), MobileConnectClient.pollingInterval)
  }

  async newLoginSession(loginCallback: (public_key: string) => void) {

    const responseRaw = await fetch(this.host + '/login_session', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 'cluster': this.cluster })
    })

    const response = await responseRaw.json()

    console.log(response)

    this.loginSessionId = response.login_session_id
    this.loginCallback = loginCallback

  }

  // TODO: pass styles
  getLoginQr() {
    if (!this.loginSessionId)
      throw new Error("No login session id yet")

    const url = `${this.host}/user_login?login_session_id=${this.loginSessionId}`

    const urlFields: TransactionRequestURLFields = {
      link: new URL(url),
    }

    const loginUrl = encodeURL(urlFields)

    console.log(loginUrl)

    const loginQr = createQR(loginUrl, 350, 'transparent')

    return loginQr
  }

  async newTransactionSession(transaction: Transaction, stateCallback: (state: TransactionState) => void): Promise<string> {

    console.log(transaction)

    const serializedTx = transaction.serialize({ requireAllSignatures: false }).toString('base64')

    const responseRaw = await fetch(this.host + '/transaction_session', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 'transaction': serializedTx, 'cluster': this.cluster })
    })

    const response = await responseRaw.json()

    console.log(response)

    this.transactionSessions[response.transaction_session_id] = {
      state: "init",
      stateCallback: stateCallback,
      sessionId: response.transaction_session_id
    }

    stateCallback(this.transactionSessions[response.transaction_session_id])

    return response.transaction_session_id
  }

  getTransactionQr(txSessionId: string) {
    if (!(txSessionId in this.transactionSessions))
      throw new Error("Invalid transaction session id")

    const url = `${this.host}/get_transaction?transaction_session_id=${txSessionId}`

    const urlFields: TransactionRequestURLFields = {
      link: new URL(url),
    }

    const txUrl = encodeURL(urlFields)

    console.log(txUrl)

    const txQr = createQR(txUrl, 350, 'transparent')

    return txQr
  }

  async poll() {

    if (this.isPolling) {
      console.log("Still polling...")
      return
    }

    this.isPolling = true;

    try {

      // There is an active login session
      if (this.loginSessionId) {

        console.log("Poll login session")

        const responseRaw = await fetch(`${this.host}/login_session?login_session_id=${this.loginSessionId}`)

        if (!responseRaw.ok) {
          console.log("Request failed")
        } else {
          const response = await responseRaw.json()
          console.log(response)

          if (this.loginSessionId) {
            if (response['state'] == 'set') {
              console.log("Logged in as:", response['public_key'])

              this.loginCallback(response['public_key'])

              this.loginSessionId = undefined
            }
          }

        }
      }

      for (const txSessionId in this.transactionSessions) {
        const txSession = this.transactionSessions[txSessionId]

        if (txSession.state == "finalized" || txSession.state == "aborted" || ('err' in txSession && txSession.err != null))
          continue

        // For each active tx session

        console.log(`Poll transaction session ${txSessionId}`)

        const responseRaw = await fetch(`${this.host}/transaction_session?transaction_session_id=${txSessionId}`)

        // The user may have aborted the session
        if (txSession.state as any == "aborted") {
          continue
        }

        if (!responseRaw.ok) {
          console.log("Request failed")
        } else {
          const response = await responseRaw.json()
          console.log(response)

          Object.assign(this.transactionSessions[txSessionId], response)

          console.log(this.transactionSessions[txSessionId])

          this.transactionSessions[txSessionId].stateCallback(this.transactionSessions[txSessionId])
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  close() {
    console.log("Close client")
    // Stop polling
    this.loginSessionId = undefined
    this.transactionSessions = {}

    clearInterval(this.pollInterval)
  }
}
