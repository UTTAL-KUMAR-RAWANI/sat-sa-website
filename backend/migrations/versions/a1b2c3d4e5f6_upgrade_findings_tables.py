"""upgrade_findings_tables

Revision ID: a1b2c3d4e5f6
Revises: ed471e9b4bac
Create Date: 2026-09-13 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'ed471e9b4bac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update findings table
    op.add_column('findings', sa.Column('priority', sa.String(), server_default='MEDIUM', nullable=False))
    op.add_column('findings', sa.Column('classification', sa.String(), server_default='Security', nullable=False))
    op.add_column('findings', sa.Column('source_id', sa.Uuid(), nullable=True))
    op.add_column('findings', sa.Column('cse_id', sa.Uuid(), nullable=True))
    op.add_column('findings', sa.Column('investigation_id', sa.Uuid(), nullable=True))
    op.add_column('findings', sa.Column('control_id', sa.Uuid(), nullable=True))
    op.add_column('findings', sa.Column('assigned_by_id', sa.Uuid(), nullable=True))
    op.add_column('findings', sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('findings', sa.Column('due_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('findings', sa.Column('remediation_required', sa.Boolean(), server_default=sa.text('false'), nullable=False))

    op.create_foreign_key('fk_findings_cse_id', 'findings', 'cses', ['cse_id'], ['id'])
    op.create_foreign_key('fk_findings_investigation_id', 'findings', 'investigations', ['investigation_id'], ['id'])
    op.create_foreign_key('fk_findings_control_id', 'findings', 'controls', ['control_id'], ['id'])
    op.create_foreign_key('fk_findings_assigned_by_id', 'findings', 'users', ['assigned_by_id'], ['id'])

    # 2. Update evidence table to link to findings
    op.add_column('evidence', sa.Column('finding_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_evidence_finding_id', 'evidence', 'findings', ['finding_id'], ['id'])

    # 3. Create finding_comments table
    op.create_table(
        'finding_comments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('finding_id', sa.Uuid(), nullable=False),
        sa.Column('author_id', sa.Uuid(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=False),
        sa.Column('comment_type', sa.String(), server_default='GENERAL_COMMENT', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.ForeignKeyConstraint(['finding_id'], ['findings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_finding_comments_finding_id'), 'finding_comments', ['finding_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_finding_comments_finding_id'), table_name='finding_comments')
    op.drop_table('finding_comments')

    op.drop_constraint('fk_evidence_finding_id', 'evidence', type_='foreignkey')
    op.drop_column('evidence', 'finding_id')

    op.drop_constraint('fk_findings_assigned_by_id', 'findings', type_='foreignkey')
    op.drop_constraint('fk_findings_control_id', 'findings', type_='foreignkey')
    op.drop_constraint('fk_findings_investigation_id', 'findings', type_='foreignkey')
    op.drop_constraint('fk_findings_cse_id', 'findings', type_='foreignkey')

    op.drop_column('findings', 'remediation_required')
    op.drop_column('findings', 'due_date')
    op.drop_column('findings', 'assigned_at')
    op.drop_column('findings', 'assigned_by_id')
    op.drop_column('findings', 'control_id')
    op.drop_column('findings', 'investigation_id')
    op.drop_column('findings', 'cse_id')
    op.drop_column('findings', 'source_id')
    op.drop_column('findings', 'classification')
    op.drop_column('findings', 'priority')
