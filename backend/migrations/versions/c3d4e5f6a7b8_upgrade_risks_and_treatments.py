"""upgrade risks, treatments, and exceptions tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-13 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Upgrade 'risks' table
    op.add_column('risks', sa.Column('source', sa.String(), server_default='MANUAL', nullable=False))
    op.add_column('risks', sa.Column('source_reference', sa.String(), nullable=True))
    op.add_column('risks', sa.Column('source_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('assessment_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('control_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('cse_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('organization_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('sector_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('asset_or_system', sa.String(), nullable=True))
    op.add_column('risks', sa.Column('category', sa.String(), server_default='Cybersecurity', nullable=False))
    op.add_column('risks', sa.Column('owner_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('identified_by_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('accepted_by_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('likelihood', sa.Integer(), server_default='3', nullable=False))
    op.add_column('risks', sa.Column('impact', sa.Integer(), server_default='3', nullable=False))
    op.add_column('risks', sa.Column('inherent_score', sa.Integer(), server_default='9', nullable=False))
    op.add_column('risks', sa.Column('inherent_risk_level', sa.String(), server_default='MEDIUM', nullable=False))
    op.add_column('risks', sa.Column('existing_controls_description', sa.Text(), nullable=True))
    op.add_column('risks', sa.Column('residual_likelihood', sa.Integer(), nullable=True))
    op.add_column('risks', sa.Column('residual_impact', sa.Integer(), nullable=True))
    op.add_column('risks', sa.Column('residual_score', sa.Integer(), nullable=True))
    op.add_column('risks', sa.Column('residual_risk_level', sa.String(), nullable=True))
    op.add_column('risks', sa.Column('treatment_strategy', sa.String(), nullable=True))
    op.add_column('risks', sa.Column('treatment_owner_id', sa.Uuid(), nullable=True))
    op.add_column('risks', sa.Column('treatment_target_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('risks', sa.Column('treatment_description', sa.Text(), nullable=True))
    op.add_column('risks', sa.Column('acceptance_justification', sa.Text(), nullable=True))
    op.add_column('risks', sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('risks', sa.Column('review_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('risks', sa.Column('target_date', sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key('fk_risks_assessment_id', 'risks', 'assessments', ['assessment_id'], ['id'])
    op.create_foreign_key('fk_risks_control_id', 'risks', 'controls', ['control_id'], ['id'])
    op.create_foreign_key('fk_risks_cse_id', 'risks', 'cses', ['cse_id'], ['id'])
    op.create_foreign_key('fk_risks_organization_id', 'risks', 'organizations', ['organization_id'], ['id'])
    op.create_foreign_key('fk_risks_sector_id', 'risks', 'sectors', ['sector_id'], ['id'])
    op.create_foreign_key('fk_risks_owner_id', 'risks', 'users', ['owner_id'], ['id'])
    op.create_foreign_key('fk_risks_identified_by_id', 'risks', 'users', ['identified_by_id'], ['id'])
    op.create_foreign_key('fk_risks_accepted_by_id', 'risks', 'users', ['accepted_by_id'], ['id'])
    op.create_foreign_key('fk_risks_treatment_owner_id', 'risks', 'users', ['treatment_owner_id'], ['id'])

    # 2. Upgrade 'risk_treatments' table
    op.add_column('risk_treatments', sa.Column('business_id', sa.String(), server_default='TRT-TEMP', nullable=False))
    op.add_column('risk_treatments', sa.Column('title', sa.String(), server_default='Risk Treatment', nullable=False))
    op.add_column('risk_treatments', sa.Column('status', sa.String(), server_default='PLANNED', nullable=False))
    op.add_column('risk_treatments', sa.Column('mitigation_actions', sa.Text(), nullable=True))
    op.add_column('risk_treatments', sa.Column('transfer_details', sa.Text(), nullable=True))
    op.add_column('risk_treatments', sa.Column('avoidance_details', sa.Text(), nullable=True))
    op.add_column('risk_treatments', sa.Column('justification', sa.Text(), nullable=True))
    op.add_column('risk_treatments', sa.Column('owner_id', sa.Uuid(), nullable=True))
    op.add_column('risk_treatments', sa.Column('created_by_id', sa.Uuid(), nullable=True))
    op.add_column('risk_treatments', sa.Column('target_date', sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key('fk_risk_treatments_owner_id', 'risk_treatments', 'users', ['owner_id'], ['id'])
    op.create_foreign_key('fk_risk_treatments_created_by_id', 'risk_treatments', 'users', ['created_by_id'], ['id'])
    op.create_index(op.f('ix_risk_treatments_business_id'), 'risk_treatments', ['business_id'], unique=False)

    # 3. Upgrade 'risk_exceptions' table
    op.alter_column('risk_exceptions', 'reason', nullable=True)
    op.add_column('risk_exceptions', sa.Column('business_id', sa.String(), server_default='EXP-TEMP', nullable=False))
    op.add_column('risk_exceptions', sa.Column('title', sa.String(), server_default='Risk Exception', nullable=False))
    op.add_column('risk_exceptions', sa.Column('justification', sa.Text(), server_default='', nullable=False))
    op.add_column('risk_exceptions', sa.Column('requested_by_id', sa.Uuid(), nullable=True))
    op.add_column('risk_exceptions', sa.Column('owner_id', sa.Uuid(), nullable=True))
    op.add_column('risk_exceptions', sa.Column('start_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('risk_exceptions', sa.Column('expiry_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('risk_exceptions', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('risk_exceptions', sa.Column('status', sa.String(), server_default='REQUESTED', nullable=False))
    op.add_column('risk_exceptions', sa.Column('reviewer_comments', sa.Text(), nullable=True))

    op.create_foreign_key('fk_risk_exceptions_requested_by_id', 'risk_exceptions', 'users', ['requested_by_id'], ['id'])
    op.create_foreign_key('fk_risk_exceptions_owner_id', 'risk_exceptions', 'users', ['owner_id'], ['id'])
    op.create_index(op.f('ix_risk_exceptions_business_id'), 'risk_exceptions', ['business_id'], unique=False)


def downgrade() -> None:
    pass
