'use client';

import { useState } from 'react';
import { Lock, CheckCircle, XCircle, AlertTriangle, Info, Shield, Server } from 'lucide-react';

interface DNSSECResult {
  domain: string;
  dsRecord: { present: boolean; digest?: string; keyTag?: number; algorithm?: number };
  dnskey: { present: boolean; flags?: number; protocol?: number; algorithm?: number };
  status: 'secure' | 'insecure' | 'partial' | 'error';
  nameservers: string[];
}

async function checkDNSSEC(domain: string): Promise<DNSSECResult> {
  const result: DNSSECResult = {
    domain,
    dsRecord: { present: false },
    dnskey: { present: false },
    status: 'insecure',
    nameservers: [],
  };

  try {
    // Get NS records
    const nsResponse = await fetch(
      `https://dns.google/resolve?name=${domain}&type=NS`,
      { headers: { Accept: 'application/dns-json' } }
    );
    const nsData = await nsResponse.json();
    
    if (nsData.Answer) {
      result.nameservers = nsData.Answer
        .filter((a: any) => a.type === 2)
        .map((a: any) => a.data);
    }

    // Check DS record
    const dsResponse = await fetch(
      `https://dns.google/resolve?name=${domain}&type=DS`,
      { headers: { Accept: 'application/dns-json' } }
    );
    const dsData = await dsResponse.json();
    
    if (dsData.Answer && dsData.Answer.length > 0) {
      result.dsRecord.present = true;
      const ds = dsData.Answer[0].data.split(' ');
      result.dsRecord.keyTag = parseInt(ds[0]);
      result.dsRecord.algorithm = parseInt(ds[1]);
    }

    // Check DNSKEY
    const dnskeyResponse = await fetch(
      `https://dns.google/resolve?name=${domain}&type=DNSKEY`,
      { headers: { Accept: 'application/dns-json' } }
    );
    const dnskeyData = await dnskeyResponse.json();
    
    if (dnskeyData.Answer && dnskeyData.Answer.length > 0) {
      result.dnskey.present = true;
      const dnskey = dnskeyData.Answer[0].data.split(' ');
      result.dnskey.flags = parseInt(dnskey[0]);
      result.dnskey.protocol = parseInt(dnskey[1]);
      result.dnskey.algorithm = parseInt(dnskey[2]);
    }

    // Determine status
    if (result.dsRecord.present && result.dnskey.present) {
      result.status = 'secure';
    } else if (result.dsRecord.present || result.dnskey.present) {
      result.status = 'partial';
    } else {
      result.status = 'insecure';
    }

  } catch (error) {
    result.status = 'error';
  }

  return result;
}

export default function Home() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<DNSSECResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }
    
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const data = await checkDNSSEC(cleanDomain);
      setResult(data);
    } catch (err) {
      setError('Failed to check DNSSEC');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'secure': return <CheckCircle className="text-green-500" size={32} />;
      case 'insecure': return <XCircle className="text-red-500" size={32} />;
      case 'partial': return <AlertTriangle className="text-yellow-500" size={32} />;
      default: return <AlertTriangle className="text-gray-500" size={32} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Lock size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#f4f4f5]">DNSSEC Validator</h1>
              <p className="text-sm text-[#71717a]">Verify DNSSEC configuration</p>
            </div>
          </div>
        </header>

        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              placeholder="Enter domain (e.g., example.com)"
              className="flex-1 px-4 py-2.5 bg-[#1a1a24] border border-[#27272a] rounded-lg text-[#f4f4f5] placeholder-[#71717a] font-mono text-sm"
            />
            <button
              onClick={handleCheck}
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2 min-w-[140px]"
            >
              {loading ? <div className="spinner" /> : <><Lock size={16} /> Validate</>}
            </button>
          </div>
          {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
        </div>

        {result && (
          <div className="card animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              {getStatusIcon(result.status)}
              <div>
                <h3 className="font-semibold text-lg text-[#f4f4f5]">{result.domain}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  result.status === 'secure' ? 'status-valid' :
                  result.status === 'insecure' ? 'status-invalid' :
                  result.status === 'partial' ? 'status-warning' :
                  'bg-[#1a1a24] text-[#71717a]'
                }`}>
                  {result.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#1a1a24] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {result.dsRecord.present ? 
                    <CheckCircle size={16} className="text-green-500" /> : 
                    <XCircle size={16} className="text-red-500" />
                  }
                  <span className="font-medium">DS Record</span>
                </div>
                {result.dsRecord.present ? (
                  <div className="space-y-1 text-sm">
                    <p className="text-[#a1a1aa]">Present: <span className="text-green-400">Yes</span></p>
                    <p className="text-[#71717a] font-mono text-xs">Key Tag: {result.dsRecord.keyTag}</p>
                    <p className="text-[#71717a] font-mono text-xs">Algorithm: {result.dsRecord.algorithm}</p>
                  </div>
                ) : (
                  <p className="text-sm text-red-400">Not found - Domain is vulnerable to DNS spoofing</p>
                )}
              </div>

              <div className="p-4 bg-[#1a1a24] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {result.dnskey.present ? 
                    <CheckCircle size={16} className="text-green-500" /> : 
                    <XCircle size={16} className="text-red-500" />
                  }
                  <span className="font-medium">DNSKEY Record</span>
                </div>
                {result.dnskey.present ? (
                  <div className="space-y-1 text-sm">
                    <p className="text-[#a1a1aa]">Present: <span className="text-green-400">Yes</span></p>
                    <p className="text-[#71717a] font-mono text-xs">Flags: {result.dnskey.flags}</p>
                    <p className="text-[#71717a] font-mono text-xs">Protocol: {result.dnskey.protocol}</p>
                  </div>
                ) : (
                  <p className="text-sm text-red-400">Not found - No signing keys published</p>
                )}
              </div>
            </div>

            {result.nameservers.length > 0 && (
              <div className="mt-4 p-4 bg-[#1a1a24] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Server size={16} className="text-[#7c3aed]" />
                  <span className="font-medium">Nameservers</span>
                </div>
                <div className="space-y-1">
                  {result.nameservers.map((ns, idx) => (
                    <p key={idx} className="text-sm font-mono text-[#a1a1aa]">{ns}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Info size={16} className="text-[#7c3aed]" />
            About DNSSEC
          </h3>
          <p className="text-sm text-[#a1a1aa] mb-4">
            DNSSEC (Domain Name System Security Extensions) adds cryptographic signatures to DNS records, 
            allowing clients to verify that the records haven't been tampered with.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#1a1a24] rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} className="text-green-500" />
                <span className="text-sm font-medium">Secure</span>
              </div>
              <p className="text-xs text-[#71717a]">Both DS and DNSKEY records present</p>
            </div>
            <div className="p-3 bg-[#1a1a24] rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-yellow-500" />
                <span className="text-sm font-medium">Partial</span>
              </div>
              <p className="text-xs text-[#71717a]">Only one record present</p>
            </div>
            <div className="p-3 bg-[#1a1a24] rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={14} className="text-red-500" />
                <span className="text-sm font-medium">Insecure</span>
              </div>
              <p className="text-xs text-[#71717a]">No DNSSEC records found</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
