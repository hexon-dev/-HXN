<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hexon ($HXN) | Engineering Sustainable Liquidity</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        :root {
            --bg-dark: #0a0e14;
            --bg-card: #141b26;
            --primary-cyan: #36D1DC;
            --primary-green: #a2ff00;
            --text-main: #e2e8f0;
            --text-dim: #94a3b8;
            --accent-gradient: linear-gradient(135deg, #36D1DC 0%, #a2ff00 100%);
            --border-color: rgba(255, 255, 255, 0.1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            overflow-x: hidden;
        }

        /* Background Circuit Pattern Decoration */
        body::before {
            content: "";
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png');
            opacity: 0.1;
            z-index: -1;
        }

        .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 20px;
        }

        /* --- Header & Hero --- */
        header {
            padding: 60px 0;
            text-align: center;
            background: radial-gradient(circle at center, rgba(54, 209, 220, 0.1) 0%, transparent 70%);
        }

        .logo-placeholder {
            width: 120px;
            height: 120px;
            margin: 0 auto 20px;
            background: var(--bg-card);
            border: 2px solid var(--primary-cyan);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 30px rgba(54, 209, 220, 0.3);
        }

        .logo-placeholder i {
            font-size: 60px;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h1 {
            font-size: 3.5rem;
            font-weight: 800;
            letter-spacing: -1px;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }

        .tagline {
            font-size: 1.2rem;
            color: var(--text-dim);
            max-width: 600px;
            margin: 0 auto 30px;
        }

        .status-bar {
            display: inline-flex;
            gap: 20px;
            background: rgba(255,255,255,0.05);
            padding: 10px 25px;
            border-radius: 50px;
            border: 1px solid var(--border-color);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
        }

        .status-item span { color: var(--primary-green); }

        /* --- Bento Grid / Section Styling --- */
        section { padding: 80px 0; }

        h2 {
            font-size: 2rem;
            margin-bottom: 40px;
            display: flex;
            align-items: center;
            gap: 15px;
        }

        h2 i { color: var(--primary-cyan); }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            padding: 40px;
            border-radius: 24px;
            position: relative;
            transition: transform 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
            border-color: rgba(54, 209, 220, 0.4);
        }

        /* --- Tokenomics Table --- */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-family: 'JetBrains Mono', monospace;
        }

        th, td {
            text-align: left;
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
        }

        th { color: var(--primary-cyan); font-weight: 500; }
        td { color: #fff; }

        /* --- Architecture Phases --- */
        .phase-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }

        .phase-card {
            background: rgba(255,255,255,0.02);
            border-left: 4px solid var(--primary-green);
            padding: 30px;
            border-radius: 0 15px 15px 0;
        }

        .phase-number {
            font-family: 'JetBrains Mono', monospace;
            color: var(--primary-green);
            font-weight: bold;
            display: block;
            margin-bottom: 10px;
        }

        /* --- Roadmap --- */
        .roadmap-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .roadmap-item {
            background: var(--bg-card);
            padding: 25px;
            border-radius: 15px;
            border-top: 3px solid var(--primary-cyan);
        }

        .quarter {
            color: var(--primary-cyan);
            font-weight: bold;
            margin-bottom: 10px;
            display: block;
        }

        /* --- CTA & Links --- */
        .links-grid {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 40px;
        }

        .btn {
            padding: 12px 25px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: 0.3s;
        }

        .btn-primary {
            background: var(--accent-gradient);
            color: var(--bg-dark);
        }

        .btn-secondary {
            border: 1px solid var(--primary-cyan);
            color: var(--primary-cyan);
        }

        .btn:hover { opacity: 0.8; transform: scale(1.05); }

        footer {
            text-align: center;
            padding: 60px 0;
            color: var(--text-dim);
            font-size: 0.9rem;
            border-top: 1px solid var(--border-color);
        }

        .disclaimer {
            max-width: 700px;
            margin: 20px auto;
            font-size: 0.75rem;
            opacity: 0.6;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .phase-grid { grid-template-columns: 1fr; }
            h1 { font-size: 2.5rem; }
        }
    </style>
</head>
<body>

    <header>
        <div class="container">
            <div class="logo-placeholder">
                <i class="fa-solid fa-microchip"></i>
            </div>
            <h1>HEXON <span style="font-weight: 300;">$HXN</span></h1>
            <p class="tagline">Engineering Sustainable Liquidity Infrastructure on Solana</p>
            
            <div class="status-bar">
                <div class="status-item">VERSION <span>1.0.2</span></div>
                <div class="status-item">RELEASE <span>FEB 2026</span></div>
                <div class="status-item">STATUS <span>GENESIS PHASE</span></div>
            </div>
        </div>
    </header>

    <div class="container">
        <section id="overview">
            <div class="card">
                <h2><i class="fa-solid fa-terminal"></i> Overview</h2>
                <p>Hexon ($HXN) is a protocol designed to introduce sustainable liquidity mechanics and programmable trading constraints to the Solana ecosystem. By leveraging <strong>SPL Token-2022</strong> and custom Rust-based <strong>Transfer Hooks</strong>, Hexon enforces transparent, on-chain logic that mitigates supply concentration and bot exploitation.</p>
                <p style="margin-top: 20px; color: var(--primary-green); font-weight: 600;">Hexon is built as infrastructure, not hype.</p>
            </div>
        </section>

        <section id="problems">
            <h2><i class="fa-solid fa-triangle-exclamation"></i> The Structural Failures</h2>
            <div class="phase-grid">
                <div class="card" style="padding: 25px;">
                    <h3 style="color: var(--primary-cyan); margin-bottom: 10px;">Supply Concentration</h3>
                    <p class="text-dim">Large holders and sniper bots acquire disproportionate allocations within milliseconds of launch, crippling long-term growth.</p>
                </div>
                <div class="card" style="padding: 25px;">
                    <h3 style="color: var(--primary-cyan); margin-bottom: 10px;">Liquidity Instability</h3>
                    <p class="text-dim">Fragmented and short-term liquidity strategies create artificial volatility that discourages institutional participation.</p>
                </div>
            </div>
        </section>

        <section id="architecture">
            <h2><i class="fa-solid fa-layer-group"></i> Protocol Architecture</h2>
            <div class="phase-grid">
                <div class="phase-card">
                    <span class="phase-number">PHASE I</span>
                    <h3>Genesis Bonding Curve</h3>
                    <ul style="list-style: none; margin-top: 15px; font-size: 0.9rem;">
                        <li><i class="fa-solid fa-check" style="color:var(--primary-green)"></i> Organic Price Discovery</li>
                        <li><i class="fa-solid fa-check" style="color:var(--primary-green)"></i> Automated LP Migration</li>
                        <li><i class="fa-solid fa-check" style="color:var(--primary-green)"></i> Permanent Liquidity Burn</li>
                    </ul>
                </div>
                <div class="phase-card" style="border-left-color: var(--primary-cyan);">
                    <span class="phase-number" style="color: var(--primary-cyan);">PHASE II</span>
                    <h3>V2 Core Infrastructure</h3>
                    <ul style="list-style: none; margin-top: 15px; font-size: 0.9rem;">
                        <li><i class="fa-solid fa-code" style="color:var(--primary-cyan)"></i> Rust Transfer Hooks</li>
                        <li><i class="fa-solid fa-shield" style="color:var(--primary-cyan)"></i> 1.5% Max Wallet Limit</li>
                        <li><i class="fa-solid fa-coins" style="color:var(--primary-cyan)"></i> 5% On-Chain Enforcement</li>
                    </ul>
                </div>
            </div>
        </section>

        <section id="tokenomics">
            <div class="card">
                <h2><i class="fa-solid fa-chart-pie"></i> Tokenomics</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Parameter</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total Supply</td>
                            <td>1,000,000,000 HXN</td>
                        </tr>
                        <tr>
                            <td>Circulating Supply</td>
                            <td>100% at Launch</td>
                        </tr>
                        <tr>
                            <td>Mint Authority</td>
                            <td><span style="color: var(--primary-green);">REVOKED</span></td>
                        </tr>
                        <tr>
                            <td>Transfer Tax</td>
                            <td>0% (Phase I) · 5% (Phase II)</td>
                        </tr>
                        <tr>
                            <td>Network</td>
                            <td>Solana Mainnet (Token-2022)</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section id="roadmap">
            <h2><i class="fa-solid fa-route"></i> 2026 Roadmap</h2>
            <div class="roadmap-container">
                <div class="roadmap-item">
                    <span class="quarter">Q1</span>
                    <p>Genesis Launch & Bonding Curve Completion</p>
                </div>
                <div class="roadmap-item">
                    <span class="quarter">Q2</span>
                    <p>V2 Migration & Expanded DEX Integrations</p>
                </div>
                <div class="roadmap-item">
                    <span class="quarter">Q3</span>
                    <p>Hexon Labs Incubator Launch</p>
                </div>
                <div class="roadmap-item">
                    <span class="quarter">Q4</span>
                    <p>Cross-chain Infrastructure Exploration</p>
                </div>
            </div>
        </section>

        <section id="connect" style="text-align: center;">
            <h2>Connect with Hexon</h2>
            <div class="links-grid">
                <a href="https://twitter.com/Hexon_Coin" class="btn btn-secondary"><i class="fa-brands fa-x-twitter"></i> Twitter</a>
                <a href="https://t.me/HexonOfficial" class="btn btn-secondary"><i class="fa-brands fa-telegram"></i> Telegram</a>
                <a href="https://hexon-dev.github.io/-HXN/" class="btn btn-primary"><i class="fa-brands fa-github"></i> View GitHub</a>
            </div>
        </section>
    </div>

    <footer>
        <div class="container">
            <p>&copy; 2026 Hexon Protocol. Built on Solana.</p>
            <div class="disclaimer">
                <strong>Disclaimer:</strong> Cryptocurrency investments involve high risk. Hexon is an experimental decentralized finance protocol. This page does not constitute financial advice. Always conduct independent research.
            </div>
        </div>
    </footer>

</body>
</html>
