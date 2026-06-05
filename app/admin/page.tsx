"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, FileText, IndianRupee, Activity, Server, RefreshCw } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ ink_level: 0, pages_remaining: 0, total_revenue: 0, active_jobs: 0, system_health: "Loading..." });

  const fetchStats = () => {
    fetch("https://api.arkout.in/api/stats")
      .then(res => res.json())
      .then(data => setStats(data));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const Card = ({ title, value, icon: Icon, color }: any) => (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0A0A0A] border border-white/10 p-6 rounded-3xl shadow-xl">
      <div className="flex justify-between items-start mb-4">
        <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">{title}</span>
        <Icon className={color} size={24} />
      </div>
      <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
    </motion.div>
  );

  return (
    <main className="min-h-screen bg-black p-10 font-sans text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Server className="text-cyan-400" /> Arkout Command Center
          </h1>
          <button onClick={fetchStats} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors">
            <RefreshCw size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card title="Ink Level" value={`${stats.ink_level}%`} icon={Gauge} color="text-cyan-400" />
          <Card title="Pages Left" value={stats.pages_remaining} icon={FileText} color="text-purple-400" />
          <Card title="Total Revenue" value={`₹${stats.total_revenue.toFixed(2)}`} icon={IndianRupee} color="text-emerald-400" />
          <Card title="System Health" value={stats.system_health} icon={Activity} color="text-yellow-400" />
        </div>
      </div>
    </main>
  );
}