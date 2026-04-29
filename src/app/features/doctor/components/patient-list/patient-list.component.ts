import {
  Component, EventEmitter, inject, OnInit, Output, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { AvatarModule } from 'primeng/avatar';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DoctorStateService } from '../../services/doctor-state.service';
import { PatientResponse } from '../../models/doctor.model';
import { DoctorApiService } from '../../services/doctor-api.service';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, InputTextModule, ButtonModule,
    TagModule, TooltipModule, SkeletonModule,
    AvatarModule, IconFieldModule, InputIconModule
  ],
  template: `
<div class="patient-list-wrap">

  <!-- Toolbar -->
  <div class="list-toolbar">
    <p-iconfield>
      <p-inputicon styleClass="pi pi-search" />
      <input
        pInputText
        [(ngModel)]="searchQuery"
        placeholder="Rechercher un patient…"
        class="search-input"
      />
    </p-iconfield>
    <span class="patient-count">
      {{ filteredPatients().length }} patient{{ filteredPatients().length !== 1 ? 's' : '' }}
    </span>
  </div>

  <!-- Table -->
  <p-table
    [value]="filteredPatients()"
    [loading]="state.loading()"
    [paginator]="filteredPatients().length > 10"
    [rows]="10"
    [rowHover]="true"
    styleClass="cs-table"
    [tableStyle]="{ 'min-width': '700px' }"
  >
    <ng-template pTemplate="header">
      <tr>
        <th>Patient</th>
        <th>Email</th>
        <th>Téléphone</th>
        <th>Groupe sanguin</th>
        <th>Âge</th>
        <th class="actions-col">Actions</th>
      </tr>
    </ng-template>

    <ng-template pTemplate="body" let-patient>
      <tr>
        <td>
          <div class="patient-cell">
            <p-avatar
              [label]="initials(patient)"
              shape="circle"
              styleClass="patient-avatar"
            />
            <div class="patient-name-info">
              <span class="p-name">{{ patient.firstName }} {{ patient.lastName }}</span>
            </div>
          </div>
        </td>
        <td class="text-muted">{{ patient.email }}</td>
        <td class="text-muted">{{ patient.phoneNumber || '—' }}</td>
        <td>
          @if (patient.bloodType) {
            <span class="blood-badge">{{ patient.bloodType }}</span>
          } @else { <span class="text-muted">—</span> }
        </td>
        <td class="text-muted">{{ age(patient.dateOfBirth) }}</td>
        <td>
          <div class="row-actions">
            <p-button
              icon="pi pi-folder-open"
              [rounded]="true"
              [text]="true"
              severity="info"
              pTooltip="Dossier médical"
              tooltipPosition="top"
              (onClick)="openMedicalFile.emit(patient.id)"
            />
            <p-button
              icon="pi pi-heart"
              [rounded]="true"
              [text]="true"
              severity="success"
              pTooltip="Démarrer consultation"
              tooltipPosition="top"
              (onClick)="startConsultation.emit(patient)"
            />
            <p-button
              icon="pi pi-calendar-plus"
              [rounded]="true"
              [text]="true"
              severity="secondary"
              pTooltip="Nouveau rendez-vous"
              tooltipPosition="top"
              (onClick)="openNewAppointment(patient)"
            />
            <p-button
              icon="pi pi-trash"
              [rounded]="true"
              [text]="true"
              severity="danger"
              pTooltip="Supprimer"
              tooltipPosition="top"
              (onClick)="deletePatient(patient)"
            />
          </div>
        </td>
      </tr>
    </ng-template>

    <ng-template pTemplate="emptymessage">
      <tr>
        <td colspan="6">
          <div class="empty-table">
            <i class="pi pi-users"></i>
            <p>Aucun patient trouvé.</p>
          </div>
        </td>
      </tr>
    </ng-template>

    <ng-template pTemplate="loadingbody">
      @for (i of [1,2,3,4,5]; track i) {
        <tr>
          @for (j of [1,2,3,4,5,6]; track j) {
            <td><p-skeleton height="2rem" /></td>
          }
        </tr>
      }
    </ng-template>
  </p-table>
</div>
  `,
  styles: [`
    .patient-list-wrap {
      background: var(--card-bg, #fff);
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 12px;
      overflow: hidden;
    }

    .list-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--card-border, #e5e7eb);
    }

    .search-input { width: 280px; }

    .patient-count {
      font-size: 13px; color: #6b7280; font-family: 'DM Sans', sans-serif;
    }

    ::ng-deep .cs-table .p-datatable-thead > tr > th {
      background: #f9fafb; font-family: 'DM Sans', sans-serif;
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #6b7280;
      border-color: #e5e7eb; padding: 10px 16px;
    }
    ::ng-deep .cs-table .p-datatable-tbody > tr > td {
      font-family: 'DM Sans', sans-serif; font-size: 14px;
      border-color: #f3f4f6; padding: 12px 16px;
    }
    ::ng-deep .cs-table .p-datatable-tbody > tr:hover > td {
      background: #f0fdf4;
    }

    .patient-cell { display: flex; align-items: center; gap: 10px; }

    ::ng-deep .patient-avatar {
      background: #022c22 !important; color: #34d399 !important;
      font-family: 'Sora', sans-serif; font-weight: 700; font-size: 13px;
      width: 36px !important; height: 36px !important;
    }

    .p-name { font-weight: 600; color: #111827; }

    .text-muted { color: #6b7280; }

    .blood-badge {
      background: #fee2e2; color: #dc2626;
      padding: 2px 8px; border-radius: 12px;
      font-size: 12px; font-weight: 700;
    }

    .actions-col { text-align: center; }
    .row-actions { display: flex; align-items: center; gap: 2px; }

    .empty-table {
      display: flex; flex-direction: column; align-items: center;
      padding: 48px; color: #9ca3af;
      .pi { font-size: 48px; margin-bottom: 12px; }
      p { font-family: 'DM Sans', sans-serif; margin: 0; }
    }
  `]
})
export class PatientListComponent implements OnInit {
  @Output() openMedicalFile  = new EventEmitter<string>();
  @Output() startConsultation = new EventEmitter<PatientResponse>();

  state = inject(DoctorStateService);
  private api = inject(DoctorApiService);

  searchQuery = '';

  filteredPatients = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.state.patients();
    return this.state.patients().filter(p =>
      `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    if (!this.state.patients().length) {
      this.state.reloadPatients();
    }
  }

  initials(p: PatientResponse): string {
    return `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase();
  }

  age(dob?: string): string {
    if (!dob) return '—';
    const years = Math.floor(
      (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    );
    return `${years} ans`;
  }

  openNewAppointment(patient: PatientResponse) {
    // Emits could be extended; for now navigate to appointments tab
    // Parent handles this via state or router
  }

  deletePatient(patient: PatientResponse) {
    if (!confirm(`Supprimer ${patient.firstName} ${patient.lastName} ?`)) return;
    this.api.deletePatient(patient.id).subscribe(() => {
      this.state.reloadPatients();
    });
  }
}