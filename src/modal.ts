import { TransactionState } from './client'
import QRCodeStyling from '@solana/qr-code-styling';

export default class QRCodeModal {

  private _outer: HTMLElement | undefined = undefined;
  private _inner: HTMLElement | undefined = undefined;

  private _initialized: Boolean = false;

  private _onClose: () => void = () => {};

  _initialize() {
    
    if(this._initialized) return
      
    if(typeof document === 'undefined') throw new Error('document is undefined')

    this._outer = document.createElement('div')
    
    this._outer.id = 'qr-code-modal'
    
    const outerStyles = {
      'position': 'fixed',
      'top': '0',
      'left': '0',
      'visibility': 'hidden'
    }

    Object.assign(this._outer.style, outerStyles)

    const bg = document.createElement('div')
    
    const bgStyles = {
      'position': 'absolute',
      'top': '0',
      'left': '0',
      'width': '100vw',
      'height': '100vh',
      'background-color': '#808080',
      'opacity': '0.3'
    }
    
    Object.assign(bg.style, bgStyles)
    
    this._outer.appendChild(bg)

    const innerContainer = document.createElement('div')

    const innerContainerStyles = {
      'position': 'absolute',
      'top': '0',
      'left': '0',
      'display': 'flex',
      'justify-content': 'center',
      'align-items': 'center',
      'height': '100vh',
      'width': '100vw',
    }
    
    Object.assign(innerContainer.style, innerContainerStyles)

    innerContainer.addEventListener("click", (event) => {
      this._onClose && this._onClose()
    })
    
    this._outer.appendChild(innerContainer)

    this._inner = document.createElement('div')

    const innerStyles = {
      'display': 'flex',
      'flex-direction': 'column',
      'background-color': 'white',
      'padding': '20px',
      'width': '500px',
      'box-sizing': 'border-box',
      'border-radius': '8px',
      'border': '1px #666 solid',
      'color': 'black',
    }

    Object.assign(this._inner.style, innerStyles)

    this._inner.addEventListener("click", (event) => {
      event.stopPropagation()
    })

    innerContainer.appendChild(this._inner)

    document.body.appendChild(this._outer)
    
    this._initialized = true
  }

  hide() {
    this._initialize();
    (this._outer as HTMLElement).style.visibility = 'hidden';
  }


  showLoginQr(loginQr: QRCodeStyling | null, onClose: () => void) {
    //this._showQr(loginQr, onClose, "Login with QR code", "Supported wallets: Phantom, Solflare, Glow (+ any wallet that supports Solana Pay)")
    
    if(loginQr !== null) {
      this._showQr(loginQr, onClose, "Login with QR code", "Supported wallets: Solflare, Glow")
    } else {
      this._showQr(loginQr, onClose, "Login with QR code", "Preparing login...")
    }
  }

  showTransactionQr(transactionQr: QRCodeStyling | null, onClose: () => void, state: TransactionState) {
    let message: string | undefined = undefined

    if (transactionQr === null) {
      message = "Preparing transaction..."
    } else {
      if ('err' in state && state['err'] != null) {
        message = "Error: " + state['err']
      } else {
        if (state.state == 'init') {
          message = "Please scan the QR code"
        } else if (state.state == 'requested') {
          message = "Waiting for confirmation..."
        } else if (state.state == 'confirmed' || state.state == 'finalized') {
          // Don't show the modal once the tx has been confirmed
          throw new Error("Invalid state")
        }
      }
    }
    this._showQr(transactionQr, onClose, "Send transaction", message as string)
  }

  _showQr(qr: QRCodeStyling | null, onClose: () => void, title: string, message: string) {

    if(typeof document === 'undefined') throw new Error('document is undefined')

    this._initialize()

    this._onClose = onClose

    const outer = this._outer as HTMLElement

    outer.style.visibility = 'visible'

    const inner = this._inner as HTMLElement

    inner.innerHTML = ''

    // Close button
    
    const headerClose = document.createElement('div')

    const headerCloseStyles = {
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'width': '28px',
      'height': '28px',
      'color': '#808080',
      'border-radius': '4px',
      'cursor': 'pointer',
      'align-self': 'flex-end'
    }

    Object.assign(headerClose.style, headerCloseStyles)

    headerClose.innerHTML = '<svg viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>'

    const headerCloseMouseoverStyles = {
      'background-color': '#f2f2f2'
    }

    headerClose.addEventListener("mouseover", (event) => {
      Object.assign(headerClose.style, headerCloseMouseoverStyles)
    })

    const headerCloseMouseoutStyles = {
      'background-color': 'transparent'
    }

    headerClose.addEventListener("mouseout", (event) => {
      Object.assign(headerClose.style, headerCloseMouseoutStyles)
    })

    headerClose.addEventListener("click", (event) => {
      this._onClose && this._onClose()
    })

    inner.appendChild(headerClose)

    // Title

    const headerTitle = document.createElement('h1')

    const headerTitleStyles = {
      'margin': '0',
      'padding': '0',
      'font-size': '32px',
      'align-self': 'center',
      'margin-bottom': '20px'
    }

    Object.assign(headerTitle.style, headerTitleStyles)

    headerTitle.innerHTML = title

    inner.appendChild(headerTitle)

    // QR Code

    if (qr !== null) {
      qr.append(inner);
      (inner.lastElementChild as HTMLElement).style['align-self' as any] = 'center'
    }

    // Text below QR Code

    const textBottom = document.createElement('div')

    const textBottomStyles = {
      'font-size': '18px',
      'margin': qr !== null ? '25px 25px 25px 25px' : '0 25px 25px 25px',
      'align-self': 'center',
    }

    Object.assign(textBottom.style, textBottomStyles)

    textBottom.innerHTML = message

    inner.append(textBottom)

  }
}
