🛡️ Hexon ($HXN)

Programmable Liquidity Infrastructure on Solana

Hexon ($HXN) is a programmable liquidity protocol built on Solana using SPL Token-2022 and custom Rust Transfer Hooks.

The project demonstrates how token-level logic can enforce sustainable market structure — reducing supply concentration, mitigating automated exploitation, and funding long-term protocol development directly on-chain.

🌐 Website https://github.com/hexon-dev/-HXN
📱 Telegram
🐦 X (Twitter)

⸻

Overview

Many fair-launch tokens rely on social coordination rather than enforceable logic.
Hexon embeds economic constraints directly into the token program itself.

The result: market rules enforced by code — not promises.

⸻

Architecture

Hexon operates in structured phases to ensure verifiable launch integrity and scalable infrastructure deployment.

⸻

Phase I — Genesis (Bonding Curve Launch)
	•	100% fair launch
	•	No private allocations
	•	Organic price discovery
	•	Automated liquidity migration
	•	Permanent LP burn

This phase establishes transparent distribution and immutable liquidity foundations.

⸻

Phase II — Core Infrastructure (V2 Migration)

Following Genesis completion, Hexon migrates to a Rust-powered Token-2022 configuration with advanced extensions.

On-Chain Enforcement
	•	1.5% Max Wallet Limit
Enforced via TransferHook programs to prevent excessive supply concentration.
	•	5% Transaction Fee (V2 Only)
Programmatically distributed:
	•	3% → Marketing & Buyback Reserve
	•	2% → Protocol Development

All logic executes at the token-program level using Token-2022 extensions.

⸻

Technical Stack

Layer	Implementation
Language	Rust (Anchor Framework)
Token Standard	SPL Token-2022
Extensions	Transfer Hook · Transfer Fee Config · Metadata Pointer
Liquidity	Raydium Integration


⸻

Token Parameters
	•	Total Supply: 1,000,000,000 HXN
	•	Circulating Supply: 100% at Launch
	•	Mint Authority: Revoked
	•	Freeze Authority: Revoked
	•	Transfer Tax:
	•	0% — Phase I
	•	5% — Phase II

Hexon is designed to be immutable once deployed.

⸻

Roadmap

Phase I — Genesis
	•	Bonding Curve Launch
	•	Liquidity Migration
	•	LP Burn

Phase II — Infrastructure
	•	Deployment of Rust Transfer Hooks
	•	V2 Token Migration
	•	Activation of Max Wallet Enforcement
	•	Automated Tax Routing

Phase III — Ecosystem Expansion
	•	Centralized Exchange Integrations
	•	Hexon Labs (Emerging Market Builder Program)
	•	DeFi Ecosystem Integrations

⸻

Security & Transparency
	•	Open-source smart contracts
	•	Publicly verifiable on-chain configuration
	•	Token-2022 extension enforcement
	•	Immutable authorities (mint & freeze revoked)

All core contracts are available in the /contracts directory for community review.

⸻

Contributing

We welcome contributions from Solana and Rust developers.

To contribute:
	1.	Fork the repository
	2.	Create a feature branch
	3.	Submit a Pull Request

Please review the contribution guidelines before submitting changes.

⸻

License

MIT License

⸻

© 2026 Hexon Labs — Built on Solana
