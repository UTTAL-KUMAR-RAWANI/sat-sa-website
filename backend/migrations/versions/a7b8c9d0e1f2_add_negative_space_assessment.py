"""Add negative space assessment and signal tables

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-09-13 23:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision = 'a7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create negative_space_assessments table
    op.create_table(
        'negative_space_assessments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('business_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('assessment_type', sa.String(), nullable=False, server_default='TELEMETRY_COVERAGE'),
        sa.Column('status', sa.String(), nullable=False, server_default='DRAFT'),
        sa.Column('dataset_id', UUID(as_uuid=True), sa.ForeignKey('datasets.id', ondelete='SET NULL'), nullable=True),
        sa.Column('analytics_run_id', UUID(as_uuid=True), sa.ForeignKey('analytics_runs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('sector_id', UUID(as_uuid=True), sa.ForeignKey('sectors.id'), nullable=True),
        sa.Column('initiated_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('baseline_window_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('baseline_window_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('comparison_window_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('comparison_window_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('configuration', JSONB, nullable=True),
        sa.Column('expected_activity_definition', JSONB, nullable=True),
        sa.Column('observed_activity_definition', JSONB, nullable=True),
        sa.Column('assessment_summary', JSONB, nullable=True),
        sa.Column('gap_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('signal_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('potential_missed_threat_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_negative_space_assessments_business_id', 'negative_space_assessments', ['business_id'], unique=True)
    op.create_index('ix_negative_space_assessments_status', 'negative_space_assessments', ['status'])
    op.create_index('ix_negative_space_assessments_dataset_id', 'negative_space_assessments', ['dataset_id'])

    # 2. Create negative_space_signals table
    op.create_table(
        'negative_space_signals',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('business_id', sa.String(), nullable=False),
        sa.Column('assessment_id', UUID(as_uuid=True), sa.ForeignKey('negative_space_assessments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('expected_activity', JSONB, nullable=True),
        sa.Column('observed_activity', JSONB, nullable=True),
        sa.Column('gap_description', sa.Text(), nullable=False),
        sa.Column('gap_percentage', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('severity', sa.String(), nullable=False, server_default='MEDIUM'),
        sa.Column('confidence', sa.String(), nullable=False, server_default='MEDIUM'),
        sa.Column('time_window_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('time_window_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('affected_asset', sa.String(), nullable=True),
        sa.Column('affected_user', sa.String(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('supporting_event_refs', JSONB, nullable=True),
        sa.Column('related_alert_id', UUID(as_uuid=True), sa.ForeignKey('alerts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('related_cse_id', UUID(as_uuid=True), sa.ForeignKey('cses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('converted_finding_id', UUID(as_uuid=True), sa.ForeignKey('findings.id', ondelete='SET NULL'), nullable=True),
        sa.Column('data_quality_concern', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('data_quality_notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='DETECTED'),
        sa.Column('reviewed_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('review_comments', sa.Text(), nullable=True),
        sa.Column('dismissal_reason', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_negative_space_signals_business_id', 'negative_space_signals', ['business_id'], unique=True)
    op.create_index('ix_negative_space_signals_assessment_id', 'negative_space_signals', ['assessment_id'])
    op.create_index('ix_negative_space_signals_status', 'negative_space_signals', ['status'])
    op.create_index('ix_negative_space_signals_severity', 'negative_space_signals', ['severity'])


def downgrade():
    op.drop_index('ix_negative_space_signals_severity', table_name='negative_space_signals')
    op.drop_index('ix_negative_space_signals_status', table_name='negative_space_signals')
    op.drop_index('ix_negative_space_signals_assessment_id', table_name='negative_space_signals')
    op.drop_index('ix_negative_space_signals_business_id', table_name='negative_space_signals')
    op.drop_table('negative_space_signals')

    op.drop_index('ix_negative_space_assessments_dataset_id', table_name='negative_space_assessments')
    op.drop_index('ix_negative_space_assessments_status', table_name='negative_space_assessments')
    op.drop_index('ix_negative_space_assessments_business_id', table_name='negative_space_assessments')
    op.drop_table('negative_space_assessments')
