"""upgrade remediations and evidence tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-13 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Upgrade 'remediations' table with operational fields
    op.add_column('remediations', sa.Column('corrective_action', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('root_cause', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('implementation_steps', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('expected_outcome', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('completion_criteria', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('dependencies', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('required_evidence_types', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('source', sa.String(), server_default='FINDING', nullable=False))
    op.add_column('remediations', sa.Column('source_id', sa.Uuid(), nullable=True))
    op.add_column('remediations', sa.Column('risk_treatment_id', sa.Uuid(), nullable=True))
    op.add_column('remediations', sa.Column('assigned_team', sa.String(), nullable=True))
    op.add_column('remediations', sa.Column('assigned_by_id', sa.Uuid(), nullable=True))
    op.add_column('remediations', sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('remediations', sa.Column('target_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('remediations', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('remediations', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('remediations', sa.Column('blocked_reason', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('blocked_by_id', sa.Uuid(), nullable=True))
    op.add_column('remediations', sa.Column('blocked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('remediations', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('remediations', sa.Column('verified_by_id', sa.Uuid(), nullable=True))
    op.add_column('remediations', sa.Column('validator_comments', sa.Text(), nullable=True))
    op.add_column('remediations', sa.Column('validation_decision', sa.String(), nullable=True))
    op.add_column('remediations', sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('remediations', sa.Column('closed_by_id', sa.Uuid(), nullable=True))
    op.add_column('remediations', sa.Column('created_by_id', sa.Uuid(), nullable=True))

    # Foreign keys for remediations
    op.create_foreign_key('fk_remediations_risk_treatment_id', 'remediations', 'risk_treatments', ['risk_treatment_id'], ['id'])
    op.create_foreign_key('fk_remediations_assigned_by_id', 'remediations', 'users', ['assigned_by_id'], ['id'])
    op.create_foreign_key('fk_remediations_blocked_by_id', 'remediations', 'users', ['blocked_by_id'], ['id'])
    op.create_foreign_key('fk_remediations_verified_by_id', 'remediations', 'users', ['verified_by_id'], ['id'])
    op.create_foreign_key('fk_remediations_closed_by_id', 'remediations', 'users', ['closed_by_id'], ['id'])
    op.create_foreign_key('fk_remediations_created_by_id', 'remediations', 'users', ['created_by_id'], ['id'])

    # Indexes on remediations
    op.create_index('ix_remediations_status', 'remediations', ['status'])
    op.create_index('ix_remediations_finding_id', 'remediations', ['finding_id'])
    op.create_index('ix_remediations_risk_id', 'remediations', ['risk_id'])
    op.create_index('ix_remediations_owner_id', 'remediations', ['owner_id'])
    op.create_index('ix_remediations_organization_id', 'remediations', ['organization_id'])

    # 2. Add remediation_id to 'evidence' table
    op.add_column('evidence', sa.Column('remediation_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_evidence_remediation_id', 'evidence', 'remediations', ['remediation_id'], ['id'])
    op.create_index('ix_evidence_remediation_id', 'evidence', ['remediation_id'])


def downgrade() -> None:
    # 2. Downgrade evidence
    op.drop_index('ix_evidence_remediation_id', table_name='evidence')
    op.drop_constraint('fk_evidence_remediation_id', 'evidence', type_='foreignkey')
    op.drop_column('evidence', 'remediation_id')

    # 1. Downgrade remediations
    op.drop_index('ix_remediations_organization_id', table_name='remediations')
    op.drop_index('ix_remediations_owner_id', table_name='remediations')
    op.drop_index('ix_remediations_risk_id', table_name='remediations')
    op.drop_index('ix_remediations_finding_id', table_name='remediations')
    op.drop_index('ix_remediations_status', table_name='remediations')

    op.drop_constraint('fk_remediations_created_by_id', 'remediations', type_='foreignkey')
    op.drop_constraint('fk_remediations_closed_by_id', 'remediations', type_='foreignkey')
    op.drop_constraint('fk_remediations_verified_by_id', 'remediations', type_='foreignkey')
    op.drop_constraint('fk_remediations_blocked_by_id', 'remediations', type_='foreignkey')
    op.drop_constraint('fk_remediations_assigned_by_id', 'remediations', type_='foreignkey')
    op.drop_constraint('fk_remediations_risk_treatment_id', 'remediations', type_='foreignkey')

    op.drop_column('remediations', 'created_by_id')
    op.drop_column('remediations', 'closed_by_id')
    op.drop_column('remediations', 'closed_at')
    op.drop_column('remediations', 'validation_decision')
    op.drop_column('remediations', 'validator_comments')
    op.drop_column('remediations', 'verified_by_id')
    op.drop_column('remediations', 'verified_at')
    op.drop_column('remediations', 'blocked_at')
    op.drop_column('remediations', 'blocked_by_id')
    op.drop_column('remediations', 'blocked_reason')
    op.drop_column('remediations', 'completed_at')
    op.drop_column('remediations', 'started_at')
    op.drop_column('remediations', 'target_date')
    op.drop_column('remediations', 'assigned_at')
    op.drop_column('remediations', 'assigned_by_id')
    op.drop_column('remediations', 'assigned_team')
    op.drop_column('remediations', 'risk_treatment_id')
    op.drop_column('remediations', 'source_id')
    op.drop_column('remediations', 'source')
    op.drop_column('remediations', 'required_evidence_types')
    op.drop_column('remediations', 'dependencies')
    op.drop_column('remediations', 'completion_criteria')
    op.drop_column('remediations', 'expected_outcome')
    op.drop_column('remediations', 'implementation_steps')
    op.drop_column('remediations', 'root_cause')
    op.drop_column('remediations', 'corrective_action')
