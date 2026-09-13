"""upgrade_security_operations_tables

Revision ID: ed471e9b4bac
Revises: eaf2d3078430
Create Date: 2026-09-13 11:44:03.128827

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ed471e9b4bac'
down_revision: Union[str, Sequence[str], None] = 'eaf2d3078430'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update security_events
    op.add_column('security_events', sa.Column('business_id', sa.String(), nullable=True))
    op.add_column('security_events', sa.Column('event_type', sa.String(), server_default='GENERIC', nullable=False))
    op.add_column('security_events', sa.Column('source_system', sa.String(), nullable=True))
    op.add_column('security_events', sa.Column('severity', sa.String(), server_default='MEDIUM', nullable=False))
    op.add_column('security_events', sa.Column('organization_id', sa.Uuid(), nullable=True))
    op.add_column('security_events', sa.Column('sector_id', sa.Uuid(), nullable=True))
    op.add_column('security_events', sa.Column('raw_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.alter_column('security_events', 'source', existing_type=sa.VARCHAR(), server_default='SIEM', nullable=False)
    op.create_index(op.f('ix_security_events_business_id'), 'security_events', ['business_id'], unique=True)
    op.create_foreign_key('fk_security_events_organizations', 'security_events', 'organizations', ['organization_id'], ['id'])
    op.create_foreign_key('fk_security_events_sectors', 'security_events', 'sectors', ['sector_id'], ['id'])

    # 2. Update alerts
    op.add_column('alerts', sa.Column('severity', sa.String(), server_default='MEDIUM', nullable=False))
    op.add_column('alerts', sa.Column('priority', sa.String(), server_default='P3', nullable=False))
    op.add_column('alerts', sa.Column('source', sa.String(), server_default='SIEM', nullable=False))
    op.add_column('alerts', sa.Column('organization_id', sa.Uuid(), nullable=True))
    op.add_column('alerts', sa.Column('sector_id', sa.Uuid(), nullable=True))
    op.add_column('alerts', sa.Column('assigned_to_id', sa.Uuid(), nullable=True))
    op.add_column('alerts', sa.Column('triage_notes', sa.Text(), nullable=True))
    op.add_column('alerts', sa.Column('triage_decision', sa.String(), nullable=True))
    op.add_column('alerts', sa.Column('triaged_by_id', sa.Uuid(), nullable=True))
    op.add_column('alerts', sa.Column('triaged_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_alerts_sectors', 'alerts', 'sectors', ['sector_id'], ['id'])
    op.create_foreign_key('fk_alerts_organizations', 'alerts', 'organizations', ['organization_id'], ['id'])
    op.create_foreign_key('fk_alerts_assigned_to_users', 'alerts', 'users', ['assigned_to_id'], ['id'])
    op.create_foreign_key('fk_alerts_triaged_by_users', 'alerts', 'users', ['triaged_by_id'], ['id'])

    # 3. Update cses
    op.alter_column('cses', 'severity', existing_type=sa.VARCHAR(), server_default='MEDIUM', nullable=False)
    op.alter_column('cses', 'priority', existing_type=sa.VARCHAR(), server_default='P3', nullable=False)
    op.alter_column('cses', 'source', existing_type=sa.VARCHAR(), server_default='ALERT', nullable=False)

    # 4. Update investigations
    op.add_column('investigations', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('investigations', sa.Column('lead_analyst_id', sa.Uuid(), nullable=True))
    op.add_column('investigations', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('investigations', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('investigations', sa.Column('findings_summary', sa.Text(), nullable=True))
    op.create_foreign_key('fk_investigations_lead_analyst', 'investigations', 'users', ['lead_analyst_id'], ['id'])

    # 5. Update evidence
    op.add_column('evidence', sa.Column('business_id', sa.String(), nullable=True))
    op.add_column('evidence', sa.Column('title', sa.String(), server_default='Evidence Item', nullable=False))
    op.add_column('evidence', sa.Column('evidence_type', sa.String(), server_default='LOG', nullable=False))
    op.add_column('evidence', sa.Column('source', sa.String(), nullable=True))
    op.add_column('evidence', sa.Column('filename', sa.String(), nullable=True))
    op.add_column('evidence', sa.Column('content_type', sa.String(), nullable=True))
    op.add_column('evidence', sa.Column('file_size', sa.BigInteger(), nullable=True))
    op.add_column('evidence', sa.Column('checksum', sa.String(), nullable=True))
    op.add_column('evidence', sa.Column('uploaded_by_id', sa.Uuid(), nullable=True))
    op.add_column('evidence', sa.Column('cse_id', sa.Uuid(), nullable=True))
    op.alter_column('evidence', 'description', existing_type=sa.VARCHAR(), type_=sa.Text(), nullable=True)
    op.alter_column('evidence', 'investigation_id', existing_type=sa.UUID(), nullable=True)
    op.create_index(op.f('ix_evidence_business_id'), 'evidence', ['business_id'], unique=True)
    op.create_foreign_key('fk_evidence_users', 'evidence', 'users', ['uploaded_by_id'], ['id'])
    op.create_foreign_key('fk_evidence_cses', 'evidence', 'cses', ['cse_id'], ['id'])

    # 6. Update assignments
    op.add_column('assignments', sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('assignments', sa.Column('due_at', sa.DateTime(timezone=True), nullable=True))

    # 7. Update escalations
    op.add_column('escalations', sa.Column('business_id', sa.String(), nullable=True))
    op.add_column('escalations', sa.Column('severity', sa.String(), server_default='HIGH', nullable=False))
    op.add_column('escalations', sa.Column('status', sa.String(), server_default='OPEN', nullable=False))
    op.add_column('escalations', sa.Column('escalated_to_role_id', sa.Uuid(), nullable=True))
    op.add_column('escalations', sa.Column('resolution', sa.Text(), nullable=True))
    op.add_column('escalations', sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_escalations_business_id'), 'escalations', ['business_id'], unique=True)
    op.create_foreign_key('fk_escalations_roles', 'escalations', 'roles', ['escalated_to_role_id'], ['id'])


def downgrade() -> None:
    # Downgrade escalations
    op.drop_constraint('fk_escalations_roles', 'escalations', type_='foreignkey')
    op.drop_index(op.f('ix_escalations_business_id'), table_name='escalations')
    op.drop_column('escalations', 'resolved_at')
    op.drop_column('escalations', 'resolution')
    op.drop_column('escalations', 'escalated_to_role_id')
    op.drop_column('escalations', 'status')
    op.drop_column('escalations', 'severity')
    op.drop_column('escalations', 'business_id')

    # Downgrade assignments
    op.drop_column('assignments', 'due_at')
    op.drop_column('assignments', 'notes')

    # Downgrade evidence
    op.drop_constraint('fk_evidence_cses', 'evidence', type_='foreignkey')
    op.drop_constraint('fk_evidence_users', 'evidence', type_='foreignkey')
    op.drop_index(op.f('ix_evidence_business_id'), table_name='evidence')
    op.alter_column('evidence', 'investigation_id', existing_type=sa.UUID(), nullable=False)
    op.alter_column('evidence', 'description', existing_type=sa.Text(), type_=sa.VARCHAR(), nullable=False)
    op.drop_column('evidence', 'cse_id')
    op.drop_column('evidence', 'uploaded_by_id')
    op.drop_column('evidence', 'checksum')
    op.drop_column('evidence', 'file_size')
    op.drop_column('evidence', 'content_type')
    op.drop_column('evidence', 'filename')
    op.drop_column('evidence', 'source')
    op.drop_column('evidence', 'evidence_type')
    op.drop_column('evidence', 'title')
    op.drop_column('evidence', 'business_id')

    # Downgrade investigations
    op.drop_constraint('fk_investigations_lead_analyst', 'investigations', type_='foreignkey')
    op.drop_column('investigations', 'findings_summary')
    op.drop_column('investigations', 'completed_at')
    op.drop_column('investigations', 'started_at')
    op.drop_column('investigations', 'lead_analyst_id')
    op.drop_column('investigations', 'description')

    # Downgrade cses
    op.alter_column('cses', 'source', existing_type=sa.VARCHAR(), nullable=True)
    op.alter_column('cses', 'priority', existing_type=sa.VARCHAR(), nullable=True)
    op.alter_column('cses', 'severity', existing_type=sa.VARCHAR(), nullable=True)

    # Downgrade alerts
    op.drop_constraint('fk_alerts_triaged_by_users', 'alerts', type_='foreignkey')
    op.drop_constraint('fk_alerts_assigned_to_users', 'alerts', type_='foreignkey')
    op.drop_constraint('fk_alerts_organizations', 'alerts', type_='foreignkey')
    op.drop_constraint('fk_alerts_sectors', 'alerts', type_='foreignkey')
    op.drop_column('alerts', 'triaged_at')
    op.drop_column('alerts', 'triaged_by_id')
    op.drop_column('alerts', 'triage_decision')
    op.drop_column('alerts', 'triage_notes')
    op.drop_column('alerts', 'assigned_to_id')
    op.drop_column('alerts', 'sector_id')
    op.drop_column('alerts', 'organization_id')
    op.drop_column('alerts', 'source')
    op.drop_column('alerts', 'priority')
    op.drop_column('alerts', 'severity')

    # Downgrade security_events
    op.drop_constraint('fk_security_events_sectors', 'security_events', type_='foreignkey')
    op.drop_constraint('fk_security_events_organizations', 'security_events', type_='foreignkey')
    op.drop_index(op.f('ix_security_events_business_id'), table_name='security_events')
    op.alter_column('security_events', 'source', existing_type=sa.VARCHAR(), nullable=True)
    op.drop_column('security_events', 'raw_metadata')
    op.drop_column('security_events', 'sector_id')
    op.drop_column('security_events', 'organization_id')
    op.drop_column('security_events', 'severity')
    op.drop_column('security_events', 'source_system')
    op.drop_column('security_events', 'event_type')
    op.drop_column('security_events', 'business_id')
