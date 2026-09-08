<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Arkout Kiosk Terminal</title>
    <style>
        :root {
            --apple-bg: rgba(22, 22, 23, 0.75);
            --apple-border: rgba(255, 255, 255, 0.12);
            --apple-blur: blur(30px);
        }

        body, html { 
            margin: 0; padding: 0; width: 100vw; height: 100vh; 
            overflow: hidden; background-color: #000; 
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif; 
            color: #f5f5f7; -webkit-font-smoothing: antialiased;
        }
        
        /* Background Video Ad */
        .video-bg { 
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            object-fit: cover; z-index: 1; 
            filter: blur(0px) brightness(1);
            transition: filter 0.8s cubic-bezier(0.16, 1, 0.3, 1); 
        }
        
        .qr-widget {
            position: absolute; bottom: 40px; right: 40px; z-index: 2;
            background: var(--apple-bg); backdrop-filter: var(--apple-blur);
            -webkit-backdrop-filter: var(--apple-blur);
            border: 1px solid var(--apple-border); border-radius: 32px; padding: 28px;
            display: flex; flex-direction: column; align-items: center; text-align: center;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease;
        }
        
        .pin-badge { 
            background: rgba(255, 255, 255, 0.08); color: #fff; font-weight: 500; font-size: 13px; 
            padding: 6px 14px; border-radius: 20px; margin-bottom: 16px; letter-spacing: 2px; 
            border: 1px solid rgba(255, 255, 255, 0.1); text-transform: uppercase;
        }
        
        .qr-container {
            background: #ffffff; padding: 12px; border-radius: 20px; margin-bottom: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .qr-image { width: 160px; height: 160px; border-radius: 8px; display: block; }
        
        .qr-title { font-size: 19px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 4px 0; color: #fff; }
        .qr-subtitle { color: #86868b; font-size: 13px; font-weight: 400; letter-spacing: 0.01em; }

        .overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            z-index: 10; display: flex; flex-direction: column; justify-content: center; align-items: center;
            opacity: 0; pointer-events: none; transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .overlay.active { opacity: 1; pointer-events: auto; }
        
        .status-card {
            background: rgba(25, 25, 28, 0.75); border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 36px; padding: 48px 64px; display: flex; flex-direction: column; align-items: center;
            box-shadow: 0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15);
            backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);
            max-width: 440px; width: 100%; text-align: center;
            transform: scale(0.95); transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .overlay.active .status-card { transform: scale(1); }

        .status-title { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; color: #fff; margin-bottom: 8px; }
        .status-desc { font-size: 14px; color: #86868b; font-weight: 400; line-height: 1.4; margin-bottom: 24px; }
        .status-file { font-size: 13px; color: #f5f5f7; background: rgba(255,255,255,0.06); padding: 8px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); font-family: ui-monospace, monospace; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .spinner { 
            width: 44px; height: 44px; border: 3px solid rgba(255, 255, 255, 0.15); 
            border-radius: 50%; border-top-color: #fff; animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite; 
            margin-bottom: 24px; 
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* --- DYNAMIC RECEIPT ANIMATION CSS --- */
        .anim-container {
            position: relative; width: 280px; height: 260px; margin-bottom: 20px;
            display: flex; flex-direction: column; align-items: center;
        }
        /* Crop the PNG to only show the golden slot */
        .printer-slot-img {
            position: relative; z-index: 10; width: 100%; height: 60px; 
            object-fit: cover; object-position: center 23%; border-radius: 12px;
            background: #fff; /* Fills transparent space if PNG is clean */
        }
        /* Hidden area for the paper to slide out of */
        .receipt-mask {
            position: absolute; top: 40px; left: 20px; right: 20px; height: 220px;
            overflow: hidden; z-index: 5;
        }
        .receipt-paper {
            background: #fdfdfd; color: #1d1d1f; padding: 20px; border-radius: 0 0 12px 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4); text-align: left;
            transform: translateY(-100%); /* Starts hidden up inside the slot */
        }
        /* The animation trigger */
        .overlay.active .receipt-paper {
            animation: slide-receipt 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            animation-delay: 0.2s;
        }
        @keyframes slide-receipt {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(0); }
        }
        
        .receipt-header { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px dashed #d2d2d7; padding-bottom: 12px; }
        .receipt-header svg { width: 20px; height: 20px; color: #00e5ff; }
        .receipt-header h4 { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: 1px; color: #000; }
        .receipt-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; font-family: ui-monospace, monospace; }
        .receipt-row .label { color: #86868b; }
        .receipt-row .value { font-weight: 600; color: #1d1d1f; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .receipt-total { border-top: 1px dashed #d2d2d7; padding-top: 12px; margin-top: 4px; font-size: 14px; }
        .barcode { font-family: monospace; font-size: 18px; font-weight: bold; text-align: center; margin-top: 12px; color: #1d1d1f; opacity: 0.8; letter-spacing: 2px;}
    </style>
</head>
<body>

    <video id="idle-video" class="video-bg" autoplay loop muted playsinline>
        <source src="promo.mp4" type="video/mp4">
    </video>
    
    <div id="idle-qr" class="qr-widget">
        <div id="pin-text" class="pin-badge">SECURE SYNC</div>
        <div class="qr-container">
            <img id="dynamic-qr" src="" alt="Scan to Print" class="qr-image">
        </div>
        <h2 class="qr-title">Scan to Print</h2>
        <div class="qr-subtitle">Point camera or open arkout.in</div>
    </div>

    <!-- Step 1: Processing Overlay -->
    <div id="overlay-processing" class="overlay">
        <div class="status-card">
            <div class="spinner"></div>
            <div class="status-title">Preparing Documents</div>
            <div class="status-desc">Analyzing pages and formatting layout securely on node.</div>
            <div id="processing-filename" class="status-file">Synchronizing...</div>
        </div>
    </div>

    <!-- Step 2: Payment Confirmation Overlay -->
    <div id="overlay-payment" class="overlay">
        <div class="status-card">
            <div class="spinner" style="border-top-color: #00e5ff;"></div>
            <div class="status-title">Confirming Payment</div>
            <div class="status-desc">Please complete the transaction on your mobile device to authorize hardware.</div>
        </div>
    </div>

    <!-- Step 3: Printing Overlay (With Native Animated Receipt) -->
    <div id="overlay-printing" class="overlay">
        <div class="status-card">
            
            <div class="anim-container">
                <!-- Using your provided image -->
                <img src="IMG_8764.PNG" alt="Hardware Slot" class="printer-slot-img">
                
                <div class="receipt-mask">
                    <!-- The Digital Paper -->
                    <div class="receipt-paper">
                        <div class="receipt-header">
                            <!-- SVG Printpod Logo -->
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
                            <h4>ARKOUT</h4>
                        </div>
                        <div class="receipt-row">
                            <span class="label">Document</span>
                            <span class="value" id="receipt-doc">File</span>
                        </div>
                        <div class="receipt-row">
                            <span class="label">Status</span>
                            <span class="value">PAID - SECURE</span>
                        </div>
                        <div class="receipt-row receipt-total">
                            <span class="label">TOTAL</span>
                            <span class="value" id="receipt-amount">₹0.00</span>
                        </div>
                        <div class="barcode">||| || | ||| | || |||</div>
                    </div>
                </div>
            </div>

            <div class="status-title">Printing in Progress</div>
            <div class="status-desc">Please collect your print. Thank you for choosing Arkout</div>
        </div>
    </div>

    <script>
        let currentState = "idle";
        let currentPin = "";
        
        const video = document.getElementById('idle-video');
        const qr = document.getElementById('idle-qr');
        
        const overlayProcessing = document.getElementById('overlay-processing');
        const overlayPayment = document.getElementById('overlay-payment');
        const overlayPrinting = document.getElementById('overlay-printing');
        
        const processingFilename = document.getElementById('processing-filename');
        const receiptDoc = document.getElementById('receipt-doc');
        const receiptAmount = document.getElementById('receipt-amount');
        
        const dynamicQr = document.getElementById('dynamic-qr');
        const pinText = document.getElementById('pin-text');

        async function pollState() {
            try {
                const response = await fetch("http://127.0.0.1:5001/api/kiosk-state");
                const data = await response.json();

                if (data.pin !== currentPin) {
                    currentPin = data.pin;
                    pinText.innerText = `TERMINAL PIN: ${currentPin}`;
                    const url = encodeURIComponent(`https://www.arkout.in/print?pin=${currentPin}`);
                    dynamicQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${url}&margin=0`;
                }

                if (data.status !== currentState) {
                    currentState = data.status;
                    // Pass the newly added amount data to the UI function
                    updateUI(currentState, data.filename, data.amount);
                }
            } catch (error) {
                console.error("Local node communication paused...");
            }
        }

        function updateUI(state, filename, amount) {
            overlayProcessing.classList.remove('active');
            overlayPayment.classList.remove('active');
            overlayPrinting.classList.remove('active');
            
            if (state === "processing") {
                video.style.filter = 'blur(6px) brightness(0.85)';
                qr.style.opacity = '0';
                qr.style.transform = 'translateY(20px)';
                processingFilename.innerText = filename || "Document package";
                overlayProcessing.classList.add('active');
            } 
            else if (state === "payment") {
                video.style.filter = 'blur(6px) brightness(0.85)';
                qr.style.opacity = '0';
                qr.style.transform = 'translateY(20px)';
                overlayPayment.classList.add('active');
            }
            else if (state === "printing") {
                video.style.filter = 'blur(6px) brightness(0.85)';
                qr.style.opacity = '0';
                qr.style.transform = 'translateY(20px)';
                
                // Inject the dynamic data into the paper receipt!
                receiptDoc.innerText = filename || "Document";
                receiptAmount.innerText = `₹${parseFloat(amount || 0).toFixed(2)}`;
                
                overlayPrinting.classList.add('active');
            }
            else {
                video.style.filter = 'blur(0px) brightness(1)';
                qr.style.opacity = '1';
                qr.style.transform = 'translateY(0)';
            }
        }

        setInterval(pollState, 1000);
    </script>
</body>
</html>
