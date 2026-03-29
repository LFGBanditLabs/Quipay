
'use client';

import { useState } from 'react';
import { Image as ImageIcon, CheckCircle, Smartphone } from 'lucide-react';
import { MOCK_NFTS } from '@/lib/contracts';

export default function NFTPage() {
    const [selectedNft, setSelectedNft] = useState<number | null>(null);

    const activeNft = selectedNft ? MOCK_NFTS.find(n => n.id === selectedNft) : null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold mb-2">NFT Verification</h1>
                    <p className="text-slate-400">Use your premium Stacks NFTs as collateral for loans</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* NFT Selection */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold">Your Wallet NFTs</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {MOCK_NFTS.map((nft) => (
                            <div
                                key={nft.id}
                                onClick={() => setSelectedNft(nft.id)}
                                className={`bg-slate-900 border rounded-xl overflow-hidden cursor-pointer transition-all ${selectedNft === nft.id
                                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                                        : 'border-slate-800 hover:border-slate-700'
                                    }`}
                            >
                                <div className="aspect-square bg-slate-800 relative">
                                    {/* Placeholder for actual image */}
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                                        <ImageIcon className="w-12 h-12" />
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold truncate">{nft.name}</h3>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-xs text-slate-400">Floor Price</span>
                                        <span className="font-mono text-sm">{nft.floor} STX</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Loan Calculation */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit">
                    <h2 className="text-xl font-bold mb-6">Loan Estimator</h2>

                    {activeNft ? (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
                                <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-slate-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold">{activeNft.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Verified Collection
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                                    <div className="text-slate-400 text-sm mb-1">Max LTV</div>
                                    <div className="text-xl font-bold text-white">50%</div>
                                </div>
                                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                                    <div className="text-slate-400 text-sm mb-1">Max Loan</div>
                                    <div className="text-xl font-bold text-blue-400">{activeNft.floor * 0.5} STX</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Collateral Value</span>
                                    <span>{activeNft.floor} STX</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Liquidation Price</span>
                                    <span className="text-red-400">{activeNft.floor * 0.8} STX</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Interest Rate</span>
                                    <span>8.5% APR</span>
                                </div>
                            </div>

                            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors">
                                Get Estimated Loan
                            </button>

                            <p className="text-xs text-center text-slate-500">
                                NFT will be held in escrow until loan is repaid.
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500">
                            <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Select an NFT from your wallet to calculate loan terms.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
