'use client';

import React from 'react';
import { Users, Shield, ArrowRight } from 'lucide-react';

export interface TeamCardData {
  id: string;
  name: string;
  tag: string;
  captainId: string;
  gameSlug: string;
  memberCap: number;
  status: 'open' | 'closed';
  description?: string | null;
  activeMembersCount: number;
  openSlots: number;
  availability: 'open' | 'closed' | 'full';
  captainUsername?: string | null;
  captainIgn?: string | null;
  captainAvatarPreset?: string | null;
  hasPendingRequest?: boolean;
}

export interface TeamCardProps {
  team: TeamCardData;
  onViewRoster: (team: TeamCardData) => void;
}

export function TeamCard({ team, onViewRoster }: TeamCardProps) {
  const isOpen = team.availability === 'open';

  return (
    <article
      data-testid="team-card"
      className="group relative flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-5 transition-transform duration-[120ms] ease-out hover:-translate-y-0.5 hover:border-border-prominent"
    >
      {/* Top Header: Tag & Availability Badge */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          {/* Squad Tag in Cyan Depth */}
          <span
            data-testid="team-tag"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono font-bold tracking-wider text-cyan-depth bg-[#1B8F97]/15 border border-[#1B8F97]/30"
          >
            <Shield className="h-3 w-3" />
            [{team.tag}]
          </span>

          {/* Dynamic Availability Status Badge */}
          <span
            data-testid="team-availability-badge"
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border transition-colors duration-[120ms] ${
              isOpen
                ? 'text-emerald-primary bg-[#1FAE7A]/15 border-[#1FAE7A]/30'
                : 'text-text-muted bg-[#223530]/20 border-[#223530]'
            }`}
          >
            {isOpen ? 'Open to Join' : team.availability === 'full' ? 'Full / Closed' : 'Closed'}
          </span>
        </div>

        {/* Squad Name Heading */}
        <h3
          data-testid="team-name"
          className="text-lg font-bold tracking-tight text-text-primary mb-1.5 group-hover:text-emerald-primary transition-colors duration-[120ms]"
        >
          {team.name}
        </h3>

        {/* Squad Description */}
        <p className="text-xs text-text-secondary line-clamp-2 min-h-[32px] mb-4">
          {team.description || 'Competitive squad recruiting active players for ranked tournaments.'}
        </p>
      </div>

      {/* Bottom Footer: Roster Gauge, Open Slots, and CTA Button */}
      <div className="pt-3 border-t border-border-subtle flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          {/* Member Roster Gauge */}
          <div
            data-testid="team-member-gauge"
            className="flex items-center gap-1.5 font-medium text-text-secondary"
          >
            <Users className="h-3.5 w-3.5 text-text-muted" />
            <span>
              {team.activeMembersCount} / {team.memberCap} Members
            </span>
          </div>

          {/* Dynamic Open Slot Pill */}
          <span
            data-testid="team-open-slots"
            className={`font-semibold text-[11px] px-2 py-0.5 rounded ${
              team.openSlots > 0
                ? 'text-emerald-primary bg-[#1FAE7A]/10'
                : 'text-text-muted bg-border-subtle/40'
            }`}
          >
            {team.openSlots} Open Slots
          </span>
        </div>

        {/* View Roster CTA Button */}
        <button
          type="button"
          onClick={() => onViewRoster(team)}
          data-testid="view-roster-button"
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg bg-bg-surface-elevated text-text-primary hover:text-emerald-primary hover:bg-[#1FAE7A]/10 border border-border-subtle hover:border-[#1FAE7A]/30 transition-transform duration-[80ms] active:scale-[0.98] min-h-[40px]"
        >
          <span>View Roster</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-[120ms] group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}

export default TeamCard;
