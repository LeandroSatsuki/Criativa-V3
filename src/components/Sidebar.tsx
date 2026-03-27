import React from 'react';
import { SectionId } from '../types';
import CriativaIcon from './CriativaIcon';
import { Home, MapPin, Camera, Boxes, CheckCircle2, PackageOpen, Send, CloudUpload, BarChart3, LogOut } from 'lucide-react';

const Sidebar: React.FC<any> = ({ activeSection, onSelect, onLogout, tasksCompleted, isCheckInDone, isOpen, user }) => {
  const isSupervisor = user?.role === 'SUPERVISOR';
  const menu = isSupervisor ? [{ id: SectionId.Supervisor, title: 'Painel Geral', icon: BarChart3 }] : [
    { id: SectionId.Dashboard, title: 'Início', icon: Home },
    { id: SectionId.CheckIn, title: 'Seleção de Loja', icon: MapPin },
    { id: SectionId.Antes, title: 'Antes', icon: Camera, disabled: !isCheckInDone },
    { id: SectionId.Estoque, title: 'Estoque', icon: Boxes, disabled: !isCheckInDone },
    { id: SectionId.Depois, title: 'Depois', icon: Camera, disabled: !isCheckInDone },
    { id: SectionId.Trocas, title: 'Trocas', icon: PackageOpen, disabled: !isCheckInDone },
    { id: SectionId.CheckOut, title: 'Check-out', icon: Send, disabled: !isCheckInDone },
    { id: SectionId.Sync, title: 'Sincronizar', icon: CloudUpload, disabled: !tasksCompleted[SectionId.CheckOut] },
  ];

  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '??';

  return (
    <nav className={`w-72 bg-[#0F172A] text-white h-full fixed left-0 top-0 z-50 transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col p-6`}>
      <div className="flex items-center gap-4 mb-10">
        <CriativaIcon color="#E65C5C" className="w-12 h-12" />
        <div>
          <h1 className="font-black text-2xl uppercase tracking-tighter leading-none">Criativa</h1>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Com. e Representações</p>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
        {menu.map(op => (
          <button 
            key={op.id} 
            disabled={op.disabled} 
            onClick={() => onSelect(op.id)} 
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeSection === op.id ? 'bg-[#E65C5C] text-white shadow-lg shadow-[#E65C5C]/20' : 'text-slate-500 hover:bg-white/5'} ${op.disabled ? 'opacity-20' : ''}`}
          >
            <op.icon className={`w-5 h-5 ${activeSection === op.id ? 'text-white' : 'text-slate-600'}`} />
            <span className="text-[11px] font-black uppercase tracking-widest flex-1 text-left">{op.title}</span>
            {tasksCompleted[op.id] && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          </button>
        ))}
      </div>
      
      <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-12 h-12 rounded-full bg-[#E65C5C] flex items-center justify-center font-black text-sm text-white shadow-lg shadow-[#E65C5C]/20">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-black text-[11px] uppercase truncate text-white">{user?.name}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{user?.region || 'Vila Velha'}</p>
          </div>
        </div>
        
        <button 
          onClick={onLogout} 
          className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
        >
          <LogOut className="w-4 h-4" /> 
          Sair da Conta
        </button>
      </div>
    </nav>
  );
};
export default Sidebar;
