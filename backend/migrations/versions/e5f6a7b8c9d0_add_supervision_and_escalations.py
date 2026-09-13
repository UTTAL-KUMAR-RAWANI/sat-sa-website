"""add supervision and escalations tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-13 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create supervisory_cases table
    op.create_table(
        'supervisory_cases',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(), server_default='HIGH', nullable=False),
        sa.Column('status', sa.String(), server_default='OPEN', nullable=False),
        sa.Column('trigger_type', sa.String(), server_default='MANUAL_ESCALATION', nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=True),
        sa.Column('sector_id', sa.Uuid(), nullable=True),
        sa.Column('created_by_id', sa.Uuid(), nullable=True),
        sa.Column('assigned_analyst_id', sa.Uuid(), nullable=True),
        sa.Column('supervisory_authority_id', sa.Uuid(), nullable=True),
        sa.Column('decided_by_id', sa.Uuid(), nullable=True),
        sa.Column('source_cse_id', sa.Uuid(), nullable=True),
        sa.Column('source_finding_id', sa.Uuid(), nullable=True),
        sa.Column('source_risk_id', sa.Uuid(), nullable=True),
        sa.Column('source_remediation_id', sa.Uuid(), nullable=True),
        sa.Column('source_assessment_id', sa.Uuid(), nullable=True),
        sa.Column('analyst_notes', sa.Text(), nullable=True),
        sa.Column('recommendation', sa.Text(), nullable=True),
        sa.Column('recommendation_submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('final_decision', sa.String(), nullable=True),
        sa.Column('decision_reason', sa.Text(), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name='fk_supervisory_cases_organization_id'),
        sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], name='fk_supervisory_cases_sector_id'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name='fk_supervisory_cases_created_by_id'),
        sa.ForeignKeyConstraint(['assigned_analyst_id'], ['users.id'], name='fk_supervisory_cases_assigned_analyst_id'),
        sa.ForeignKeyConstraint(['supervisory_authority_id'], ['users.id'], name='fk_supervisory_cases_supervisory_authority_id'),
        sa.ForeignKeyConstraint(['decided_by_id'], ['users.id'], name='fk_supervisory_cases_decided_by_id'),
        sa.ForeignKeyConstraint(['source_cse_id'], ['cses.id'], name='fk_supervisory_cases_source_cse_id'),
        sa.ForeignKeyConstraint(['source_finding_id'], ['findings.id'], name='fk_supervisory_cases_source_finding_id'),
        sa.ForeignKeyConstraint(['source_risk_id'], ['risks.id'], name='fk_supervisory_cases_source_risk_id'),
        sa.ForeignKeyConstraint(['source_remediation_id'], ['remediations.id'], name='fk_supervisory_cases_source_remediation_id'),
        sa.ForeignKeyConstraint(['source_assessment_id'], ['assessments.id'], name='fk_supervisory_cases_source_assessment_id')
    )
    op.create_index(op.f('ix_supervisory_cases_business_id'), 'supervisory_cases', ['business_id'], unique=True)

    # 2. Create supervisory_decisions table
    op.create_table(
        'supervisory_decisions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('business_id', sa.String(), nullable=False),
        sa.Column('supervisory_case_id', sa.Uuid(), nullable=False),
        sa.Column('decision_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), server_default='DRAFT', nullable=False),
        sa.Column('decision_maker_id', sa.Uuid(), nullable=False),
        sa.Column('rationale', sa.Text(), nullable=False),
        sa.Column('conditions', sa.Text(), nullable=True),
        sa.Column('action_required', sa.Text(), nullable=True),
        sa.Column('effective_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('organization_id', sa.Uuid(), nullable=True),
        sa.Column('sector_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['supervisory_case_id'], ['supervisory_cases.id'], name='fk_supervisory_decisions_case_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['decision_maker_id'], ['users.id'], name='fk_supervisory_decisions_decision_maker_id'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name='fk_supervisory_decisions_organization_id'),
        sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], name='fk_supervisory_decisions_sector_id')
    )
    op.create_index(op.f('ix_supervisory_decisions_business_id'), 'supervisory_decisions', ['business_id'], unique=True)

    # 3. Upgrade escalations table
    op.add_column('escalations', sa.Column('priority', sa.String(), server_default='HIGH', nullable=False))
    op.add_column('escalations', sa.Column('level', sa.String(), server_default='LEVEL_1', nullable=False))
    op.add_column('escalations', sa.Column('organization_id', sa.Uuid(), nullable=True))
    op.add_column('escalations', sa.Column('sector_id', sa.Uuid(), nullable=True))
    op.add_column('escalations', sa.Column('supervisory_case_id', sa.Uuid(), nullable=True))
    op.add_column('escalations', sa.Column('due_date', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_escalations_organization_id', 'escalations', 'organizations', ['organization_id'], ['id'])
    op.create_foreign_key('fk_escalations_sector_id', 'escalations', 'sectors', ['sector_id'], ['id'])
    op.create_foreign_key('fk_escalations_supervisory_case_id', 'escalations', 'supervisory_cases', ['supervisory_case_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_escalations_supervisory_case_id', 'escalations', type_='foreignkey')
    op.drop_constraint('fk_escalations_sector_id', 'escalations', type_='foreignkey')
    op.drop_constraint('fk_escalations_organization_id', 'escalations', type_='foreignkey')
    op.drop_column('escalations', 'due_date')
    op.drop_column('escalations', 'supervisory_case_id')
    op.drop_column('escalations', 'sector_id')
    op.drop_column('escalations', 'organization_id')
    op.drop_column('escalations', 'level')
    op.drop_column('escalations', 'priority')
    op.drop_index(op.f('ix_supervisory_decisions_business_id'), table_name='supervisory_decisions')
    op.drop_table('supervisory_decisions')
    op.drop_index(op.f('ix_supervisory_cases_business_id'), table_name='supervisory_cases')
    op.drop_table('supervisory_cases')
