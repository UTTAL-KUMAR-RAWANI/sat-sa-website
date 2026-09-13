"""upgrade_assessments_and_evidence

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-13 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update assessments table
    op.add_column('assessments', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('assessments', sa.Column('assessment_type', sa.String(), server_default='SECURITY_CONTROL_ASSESSMENT', nullable=False))
    op.add_column('assessments', sa.Column('priority', sa.String(), server_default='MEDIUM', nullable=False))
    op.add_column('assessments', sa.Column('scope', sa.Text(), nullable=True))
    op.add_column('assessments', sa.Column('cse_id', sa.Uuid(), nullable=True))
    op.add_column('assessments', sa.Column('investigation_id', sa.Uuid(), nullable=True))
    op.add_column('assessments', sa.Column('created_by_id', sa.Uuid(), nullable=True))
    op.add_column('assessments', sa.Column('start_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('assessments', sa.Column('due_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('assessments', sa.Column('submitted_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('assessments', sa.Column('approved_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('assessments', sa.Column('closed_date', sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key('fk_assessments_cse_id', 'assessments', 'cses', ['cse_id'], ['id'])
    op.create_foreign_key('fk_assessments_investigation_id', 'assessments', 'investigations', ['investigation_id'], ['id'])
    op.create_foreign_key('fk_assessments_created_by_id', 'assessments', 'users', ['created_by_id'], ['id'])

    # 2. Update assessment_controls table
    op.add_column('assessment_controls', sa.Column('evaluator_id', sa.Uuid(), nullable=True))
    op.add_column('assessment_controls', sa.Column('effectiveness', sa.String(), server_default='NOT_ASSESSED', nullable=False))
    op.add_column('assessment_controls', sa.Column('evaluation_notes', sa.Text(), nullable=True))
    op.add_column('assessment_controls', sa.Column('reviewer_comments', sa.Text(), nullable=True))
    op.add_column('assessment_controls', sa.Column('evidence_required', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('assessment_controls', sa.Column('evidence_submitted', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('assessment_controls', sa.Column('evidence_verified', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('assessment_controls', sa.Column('evaluated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('assessment_controls', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key('fk_assessment_controls_evaluator_id', 'assessment_controls', 'users', ['evaluator_id'], ['id'])

    # 3. Update evidence table
    op.add_column('evidence', sa.Column('assessment_id', sa.Uuid(), nullable=True))
    op.add_column('evidence', sa.Column('control_id', sa.Uuid(), nullable=True))
    op.add_column('evidence', sa.Column('verification_status', sa.String(), server_default='PENDING', nullable=False))
    op.add_column('evidence', sa.Column('verified_by_id', sa.Uuid(), nullable=True))
    op.add_column('evidence', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('evidence', sa.Column('reviewer_comments', sa.Text(), nullable=True))

    op.create_foreign_key('fk_evidence_assessment_id', 'evidence', 'assessments', ['assessment_id'], ['id'])
    op.create_foreign_key('fk_evidence_control_id', 'evidence', 'controls', ['control_id'], ['id'])
    op.create_foreign_key('fk_evidence_verified_by_id', 'evidence', 'users', ['verified_by_id'], ['id'])

    # 4. Update findings table with assessment link
    op.add_column('findings', sa.Column('assessment_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_findings_assessment_id', 'findings', 'assessments', ['assessment_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_findings_assessment_id', 'findings', type_='foreignkey')
    op.drop_column('findings', 'assessment_id')

    op.drop_constraint('fk_evidence_verified_by_id', 'evidence', type_='foreignkey')
    op.drop_constraint('fk_evidence_control_id', 'evidence', type_='foreignkey')
    op.drop_constraint('fk_evidence_assessment_id', 'evidence', type_='foreignkey')
    op.drop_column('evidence', 'reviewer_comments')
    op.drop_column('evidence', 'verified_at')
    op.drop_column('evidence', 'verified_by_id')
    op.drop_column('evidence', 'verification_status')
    op.drop_column('evidence', 'control_id')
    op.drop_column('evidence', 'assessment_id')

    op.drop_constraint('fk_assessment_controls_evaluator_id', 'assessment_controls', type_='foreignkey')
    op.drop_column('assessment_controls', 'reviewed_at')
    op.drop_column('assessment_controls', 'evaluated_at')
    op.drop_column('assessment_controls', 'evidence_verified')
    op.drop_column('assessment_controls', 'evidence_submitted')
    op.drop_column('assessment_controls', 'evidence_required')
    op.drop_column('assessment_controls', 'reviewer_comments')
    op.drop_column('assessment_controls', 'evaluation_notes')
    op.drop_column('assessment_controls', 'effectiveness')
    op.drop_column('assessment_controls', 'evaluator_id')

    op.drop_constraint('fk_assessments_created_by_id', 'assessments', type_='foreignkey')
    op.drop_constraint('fk_assessments_investigation_id', 'assessments', type_='foreignkey')
    op.drop_constraint('fk_assessments_cse_id', 'assessments', type_='foreignkey')
    op.drop_column('assessments', 'closed_date')
    op.drop_column('assessments', 'approved_date')
    op.drop_column('assessments', 'submitted_date')
    op.drop_column('assessments', 'due_date')
    op.drop_column('assessments', 'start_date')
    op.drop_column('assessments', 'created_by_id')
    op.drop_column('assessments', 'investigation_id')
    op.drop_column('assessments', 'cse_id')
    op.drop_column('assessments', 'scope')
    op.drop_column('assessments', 'priority')
    op.drop_column('assessments', 'assessment_type')
    op.drop_column('assessments', 'description')
