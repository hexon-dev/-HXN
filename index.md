<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Hexon ($HXN) - Engineering Sustainable Liquidity Infrastructure on Solana.">
    <meta name="theme-color" content="#0a0e14">
    <title>Hexon ($HXN) | Engineering Sustainable Liquidity</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        :root {
            /* Color Palette */
            --bg-dark: #050505;
            --bg-card: #0f1216;
            --bg-card-hover: #161b22;
            
            --primary-cyan: #36D1DC;
            --primary-green: #a2ff00;
            --primary-purple: #5B86E5;
            
            --text-main: #f1f5f9;
            --text-dim: #94a3b8;
            --text-accent: #36D1DC;
            
            --accent-gradient: linear-gradient(135deg, #36D1DC 0%, #5B86E5 100%);
            --border-color: rgba(255, 255, 255, 0.08);
            --glow-shadow: 0 0 20px rgba(54, 209, 220, 0.15);
        }

        /* --- Reset & Base --- */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-tap-highlight-color: transparent;
        }

        html {
            scroll-behavior: smooth;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 15% 50%, rgba(54, 209, 220, 0.05) 0%, transparent 25%),
                radial-gradient(circle at 85% 30%, rgba(162, 255, 0, 0.03) 0%, transparent 25%);
        }

        /* Subtle Grid Pattern */
        body::before {
            content: "";
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
            z-index: -1;
            pointer-events: none;
        }

        .container {
            width: 100%;
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px;
        }

        /* --- Typography --- */
        h1, h2, h3 {
            line-height: 1.2;
        }

        h2 {
            font-size: clamp(1.5rem, 4vw, 2.2rem);
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        h2 i { color: var(--primary-cyan); font-size: 0.9em; }

        code {
            font-family: 'JetBrains Mono', monospace;
            background: rgba(255,255,255,0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
            color: var(--primary-green);
        }

        /* --- Header & Hero --- */
        header {
            padding: 80px 0 60px;
            text-align: center;
            position: relative;
        }

        .logo-placeholder {
            width: 100px;
            height: 100px;
            margin: 0 auto 24px;
            background: rgba(20, 27, 38, 0.8);
            border: 1px solid var(--primary-cyan);
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 40px rgba(54, 209, 220, 0.2);
            backdrop-filter: blur(10px);
        }

        .logo-placeholder i {
            font-size: 48px;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h1 {
            font-size: clamp(2.5rem, 6vw, 4.5rem); /* Responsive H1 */
            font-weight: 800;
            letter-spacing: -2px;
            background: linear-gradient(to right, #fff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 16px;
        }

        .tagline {
            font-size: clamp(1rem, 3vw, 1.25rem);
            color: var(--text-dim);
            max-width: 600px;
            margin: 0 auto 40px;
        }

        /* Responsive Status Bar */
        .status-bar {
            display: inline-flex;
            flex-wrap: wrap; /* Allows wrapping on mobile */
            justify-content: center;
            gap: 15px;
            background: rgba(255,255,255,0.03);
            padding: 10px 20px;
            border-radius: 100px;
            border: 1px solid var(--border-color);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
        }

        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .status-item span { 
            color: var(--primary-green); 
            font-weight: 600;
        }

        .separator {
            color: var(--border-color);
        }

        /* --- Sections & Cards --- */
        section { padding: 60px 0; }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            padding: 40px;
            border-radius: 24px;
            position: relative;
            transition: all 0.3s ease;
        }

        .card:hover {
            border-color: rgba(54, 209, 220, 0.3);
            transform: translateY(-3px);
            box-shadow: var(--glow-shadow);
        }

        /* --- Phase Grid (Architecture) --- */
        .phase-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
        }

        .phase-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border-color);
            border-left: 4px solid var(--primary-green);
            padding: 30px;
            border-radius: 12px;
            height: 100%;
        }

        .phase-card.v2 {
            border-left-color: var(--primary-cyan);
        }

        .phase-number {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            color: var(--text-dim);
            display: block;
            margin-bottom: 12px;
            letter-spacing: 1px;
        }

        .phase-list {
            list-style: none;
            margin-top: 20px;
        }

        .phase-list li {
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.95rem;
            color: var(--text-dim);
        }

        /* --- Tokenomics Table (Mobile Scroll Fix) --- */
        .table-wrapper {
            width: 100%;
            overflow-x: auto; /* Adds horizontal scroll on mobile */
            -webkit-overflow-scrolling: touch;
            border-radius: 12px;
            border: 1px solid var(--border-color);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            min-width: 500px; /* Forces scroll on very small screens */
        }

        th, td {
            text-align: left;
            padding: 18px 24px;
            border-bottom: 1px solid var(--border-color);
        }

        tr:last-child td { border-bottom: none; }
        
        th { 
            background: rgba(255,255,255,0.03);
            color: var(--primary-cyan); 
            font-weight: 600; 
            text-transform: uppercase;
            font-size: 0.8rem;
        }
        
        td { color: var(--text-main); }

        /* --- Roadmap --- */
        .roadmap-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
        }

        .roadmap-item {
            background: var(--bg-card);
            padding: 24px;
            border-radius: 16px;
            border: 1px solid var(--border-color);
            transition: 0.3s;
        }

        .roadmap-item:hover {
            border-color: var(--primary-cyan);
        }

        .quarter {
            font-family: 'JetBrains Mono', monospace;
            color: var(--primary-cyan);
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 8px;
            display: block;
        }

        /* --- Buttons --- */
        .links-grid {
            display: flex;
            justify-content: center;
            gap: 16px;
            flex-wrap: wrap; /* Essential for mobile */
            margin-top: 40px;
        }

        .btn {
            padding: 14px 28px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.2s ease;
        }

        .btn-primary {
            background: var(--accent-gradient);
            color: var(--bg-dark);
            border: 1px solid transparent;
            box-shadow: 0 4px 15px rgba(54, 209, 220, 0.3);
        }

        .btn-secondary {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-main);
        }

        .btn:hover {
            transform: translateY(-2px);
        }
        
        .btn-secondary:hover {
            border-color: var(--primary-cyan);
            color: var(--primary-cyan);
        }

        /* --- Footer --- */
        footer {
            text-align: center;
            padding: 80px 0 40px;
            color: var(--text-dim);
            font-size: 0.9rem;
            border-top: 1px solid var(--border-color);
            margin-top: 40px;
        }

        .disclaimer {
            max-width: 700px;
            margin: 20px auto 0;
            font-size: 0.75rem;
            line-height: 1.5;
            opacity: 0.5;
        }

        /* --- MOBILE RESPONSIVENESS (Deep Refinement) --- */
        @media (max-width: 768px) {
            header { padding: 50px 0 30px; }
            
            section { padding: 40px 0; }

            .card { padding: 24px; }
            
            /* Stack Phase Grid vertically */
            .phase-grid {
                grid-template-columns: 1fr;
            }

            /* Adjust header status bar for small screens */
            .status-bar {
                flex-direction: column;
                gap: 5px;
                padding: 15px;
                width: 100%;
                text-align: center;
            }
            
            .separator { display: none; } /* Hide separators on mobile stack */

            /* Buttons full width on mobile */
            .links-grid {
                flex-direction: column;
            }
            
            .btn { width: 100%; }
        }
    </style>
</head>
<body>

    <header>
        <div class="container">
            <div class="logo-placeholder">
                <i class="fa-solid fa-microchip"></i>
            </div>
            <h1>HEXON <span style="font-weight: 300; opacity: 0.7;">$HXN</span></h1>
            <p class="tagline">Engineering Sustainable Liquidity Infrastructure on Solana</p>
            
            <div class="status-bar">
                <div class="status-item">VERSION <span>1.0.2</span></div>
                <div class="status-item separator">|</div>
                <div class="status-item">RELEASE <span>FEB 2026</span></div>
                <div class="status-item separator">|</div>
                <div class="status-item">STATUS <span>GENESIS</span></div>
            </div>
        </div>
    </header>

    <div class="container">
        
        <section id="overview">
            <div class="card">
                <h2><i class="fa-solid fa-terminal"></i> Overview</h2>
                <p>Hexon ($HXN) is a protocol designed to introduce sustainable liquidity mechanics and programmable trading constraints to the Solana ecosystem. By leveraging <strong>SPL Token-2022</strong> and custom Rust-based <strong>Transfer Hooks</strong>, Hexon enforces transparent, on-chain logic that mitigates supply concentration and bot exploitation.</p>
                <div style="margin-top: 20px; padding: 15px; background: rgba(162, 255, 0, 0.05); border-left: 2px solid var(--primary-green); color: var(--primary-green); font-size: 0.95rem;">
                    <strong>Core Philosophy:</strong> Hexon is built as infrastructure, not hype.
                </div>
            </div>
        </section>

        <section id="problems">
            <h2><i class="fa-solid fa-triangle-exclamation"></i> The Structural Failures</h2>
            <div class="phase-grid">
                <div class="card" style="padding: 30px;">
                    <h3 style="color: var(--primary-cyan); margin-bottom: 10px; font-size: 1.2rem;">Supply Concentration</h3>
                    <p class="text-dim" style="color: var(--text-dim); font-size: 0.95rem;">Large holders and sniper bots acquire disproportionate allocations within milliseconds of launch, crippling long-term growth.</p>
                </div>
                <div class="card" style="padding: 30px;">
                    <h3 style="color: var(--primary-cyan); margin-bottom: 10px; font-size: 1.2rem;">Liquidity Instability</h3>
                    <p class="text-dim" style="color: var(--text-dim); font-size: 0.95rem;">Fragmented and short-term liquidity strategies create artificial volatility that discourages institutional participation.</p>
                </div>
            </div>
        </section>

        <section id="architecture">
            <h2><i class="fa-solid fa-layer-group"></i> Protocol Architecture</h2>
            <div class="phase-grid">
                <div class="phase-card">
                    <span class="phase-number" style="color: var(--primary-green);">PHASE I</span>
                    <h3>Genesis Bonding Curve</h3>
                    <ul class="phase-list">
                        <li><i class="fa-solid fa-check" style="color:var(--primary-green)"></i> Organic Price Discovery</li>
                        <li><i class="fa-solid fa-check" style="color:var(--primary-green)"></i> Automated LP Migration</li>
                        <li><i class="fa-solid fa-check" style="color:var(--primary-green)"></i> Permanent Liquidity Burn</li>
                    </ul>
                </div>
                <div class="phase-card v2">
                    <span class="phase-number" style="color: var(--primary-cyan);">PHASE II</span>
                    <h3>V2 Core Infrastructure</h3>
                    <ul class="phase-list">
                        <li><i class="fa-solid fa-code" style="color:var(--primary-cyan)"></i> Rust Transfer Hooks</li>
                        <li><i class="fa-solid fa-shield" style="color:var(--primary-cyan)"></i> 1.5% Max Wallet Limit</li>
                        <li><i class="fa-solid fa-coins" style="color:var(--primary-cyan)"></i> 5% On-Chain Tax</li>
                    </ul>
                </div>
            </div>
        </section>

        <section id="tokenomics">
            <div class="card" style="padding: 0; overflow: hidden; background: transparent; border: none;">
                <div style="background: var(--bg-card); padding: 40px; border-radius: 24px; border: 1px solid var(--border-color);">
                    <h2><i class="fa-solid fa-chart-pie"></i> Tokenomics</h2>
                    <div class="table-wrapper">
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
                                    <td><span style="color: var(--primary-green); font-weight:600;"><i class="fa-solid fa-lock"></i> REVOKED</span></td>
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
                </div>
            </div>
        </section>

        <section id="roadmap">
            <h2><i class="fa-solid fa-route"></i> 2026 Roadmap</h2>
            <div class="roadmap-grid">
                <div class="roadmap-item">
                    <span class="quarter">Q1</span>
                    <p style="font-size: 0.9rem; color: var(--text-dim);">Genesis Launch & Bonding Curve Completion</p>
                </div>
                <div class="roadmap-item">
                    <span class="quarter">Q2</span>
                    <p style="font-size: 0.9rem; color: var(--text-dim);">V2 Migration & Expanded DEX Integrations</p>
                </div>
                <div class="roadmap-item">
                    <span class="quarter">Q3</span>
                    <p style="font-size: 0.9rem; color: var(--text-dim);">Hexon Labs Incubator Launch</p>
                </div>
                <div class="roadmap-item">
                    <span class="quarter">Q4</span>
                    <p style="font-size: 0.9rem; color: var(--text-dim);">Cross-chain Infrastructure Exploration</p>
                </div>
            </div>
        </section>

        <section id="connect">
            <div class="card" style="text-align: center; border-color: var(--primary-cyan);">
                <h2 style="justify-content: center; margin-bottom: 10px;">Connect with Hexon</h2>
                <p style="color: var(--text-dim);">Join the engineering of sustainable liquidity.</p>
                <div class="links-grid">
                    <a href="https://twitter.com/Hexon_Coin" class="btn btn-secondary" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-x-twitter"></i> Twitter</a>
                    <a href="https://t.me/HexonOfficial" class="btn btn-secondary" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-telegram"></i> Telegram</a>
                    <a href="https://hexon-dev.github.io/-HXN/" class="btn btn-primary" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github"></i> View GitHub</a>
                </div>
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
