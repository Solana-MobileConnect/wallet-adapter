import type { EventEmitter, SendTransactionOptions, WalletName } from '@solana/wallet-adapter-base';

import {
  BaseWalletAdapter,
  WalletReadyState,
} from '@solana/wallet-adapter-base';

import QRCodeStyling from '@solana/qr-code-styling';

import MobileConnectClient from './client'
import { TransactionState } from './client'

import QRCodeModal from './modal'

import { PublicKey, Transaction, TransactionVersion, VersionedTransaction, Connection, TransactionSignature } from '@solana/web3.js';

const util = require('util')

export const MobileConnectWalletName = 'MobileConnect' as WalletName<'MobileConnectWallet'>;

import { icon } from './icon'

export interface MobileConnectAdapterConfig {
  serverHost?: string,
  serverNetwork?: string
}

export class MobileConnectWalletAdapter extends BaseWalletAdapter {
  name = MobileConnectWalletName;
  url = 'https://solana-mobileconnect.com';
  icon = icon;

  supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set(['legacy', 0] as TransactionVersion[]);

  private _client: MobileConnectClient;

  private _connecting: boolean = false;

  private _publicKey: PublicKey | null = null;

  private _modal: QRCodeModal;
  
  private _isTransacting: boolean = false;

  private _txQr: QRCodeStyling | undefined = undefined;

  private _txSessionId: string | undefined = undefined;

  private _resolveTxPromise: any = undefined;

  private _rejectTxPromise: any = undefined;

  constructor(config: MobileConnectAdapterConfig = {}) {
    super();

    this._client = new MobileConnectClient(config.serverHost || 'https://crosspay-server.onrender.com', config.serverNetwork || 'mainnet-beta')
    this._modal = new QRCodeModal()
  }

  get publicKey() {
    return this._publicKey;
  }

  get connecting() {
    return this._connecting;
  }

  get readyState() {
    // To appear in the "Detected" list
    return WalletReadyState.Installed;
  }

  async connect(): Promise<void> {
    console.log("connect")

    try {

      if (this.connected || this._connecting) return;

      this._connecting = true;

      // Show "Preparing login..."
      this._modal.showLoginQr(null, () => {
        console.log("Abort login")
        this._modal.hide()
      })

      await this._client.newLoginSession((public_key) => {
        console.log("Logged in:", public_key)

        this._connecting = false

        this._publicKey = new PublicKey(public_key)

        this.emit('connect', this._publicKey)

        this._modal.hide()
      })

      const loginQr = this._client.getLoginQr()

      this._modal.showLoginQr(loginQr, () => {

        console.log("Abort login")

        // stop polling
        this._client.loginSessionId = undefined

        this._connecting = false;

        this._modal.hide()
      })

    } catch (error: any) {
      this.emit('error', error);
      this._connecting = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log("disconnect")
    this._publicKey = null;
    this.emit('disconnect');
  }

  async sendTransaction<T extends Transaction>(
    transaction: T,
    connection: Connection,
    options: SendTransactionOptions = {}
  ): Promise<TransactionSignature> {

    console.log("Send transaction")
    
    // Elementary checks

    try {

      if (!this._publicKey) throw new Error("Wallet not connected")

      if (!transaction.feePayer) {
        throw new Error("feePayer must be set")
      }
      
      if (this._isTransacting) {
        throw new Error("Transaction in progress")
      }

    } catch (error: any) {
      this.emit('error', error);
      throw error;
    }
    
    // Initiate transaction
    
    this._isTransacting = true;
    
    // Deferred promise

    const promise = new Promise((resolve, reject) => {
      this._resolveTxPromise = resolve
      this._rejectTxPromise = reject
    }) as Promise<TransactionSignature>

    this._client.newTransactionSession(transaction, this._onTransactionStateChange.bind(this)).catch(this._onTransactionError)
    
    // Show "Preparing transaction..."
    this._modal.showTransactionQr(null, () => {
      this._onTransactionError(new Error("User aborted transaction"))
    }, { state: 'init', sessionId: '' })

    return promise
  }
  
  _onTransactionStateChange(state: TransactionState) {
    
    console.log("TX state:", state)
    
    // For testing
    /*
    if(state['state'] == 'requested') {
      state['state'] = 'confirmed'
      state['err'] = 'some error'
    }
    */

    if (!this._isTransacting) {
      return
    }
    
    if ('err' in state && state['err'] != null) {
      console.log("TX error detected:", state['err'])

      // Show that an error occurred
      // Only pass the error back once the modal is closed
      this._txQr !== undefined && this._modal.showTransactionQr(this._txQr, () => {
        this._onTransactionError(new Error(state['err'] as string))
      }, state)

    } else if ('signature' in state && (state['state'] == 'confirmed' || state['state'] == 'finalized')) {

      console.log("TX confirmed:", state['signature'])
      
      this._onTransactionSuccess(state['signature'] as string)

    } else if (state.state == 'init' || state.state as any == 'requested') {
      
      if(this._txSessionId === undefined || this._txQr === undefined) {
        this._txSessionId = state.sessionId
        this._txQr = this._client.getTransactionQr(this._txSessionId)
      }
      
      this._modal.showTransactionQr(this._txQr, () => {
        this._onTransactionError(new Error("User aborted transaction"))
      }, state)
    }
  }

  _onTransactionError(error: Error) {
    // console.error(error)
    
    // stop polling
    this._txSessionId && (this._client.transactionSessions[this._txSessionId].state = 'aborted')
    
    console.log(this._client.transactionSessions)

    this._rejectTxPromise(error)
    this._isTransacting = false
    this._txSessionId = undefined
    this._txQr = undefined
    this._modal.hide()
  }
  
  _onTransactionSuccess(signature: TransactionSignature) {
    //console.log("TX success:", signature)

    // stop polling
    this._txSessionId && (this._client.transactionSessions[this._txSessionId].state = 'aborted')

    this._resolveTxPromise(signature)
    this._isTransacting = false
    this._txSessionId = undefined
    this._txQr = undefined
    this._modal.hide()
  }
}
