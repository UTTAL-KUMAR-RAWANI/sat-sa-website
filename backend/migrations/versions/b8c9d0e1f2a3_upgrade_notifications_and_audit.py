"""Upgrade notifications and audit tables

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-09-14 00:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision = 'b8c9d0e1f2a3'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Upgrade audit_logs table
    op.add_column('audit_logs', sa.Column('business_reference', sa.String(), nullable=True))
    op.add_column('audit_logs', sa.Column('reason', sa.Text(), nullable=True))
    op.add_column('audit_logs', sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True))
    op.add_column('audit_logs', sa.Column('sector_id', UUID(as_uuid=True), sa.ForeignKey('sectors.id'), nullable=True))
    op.add_column('audit_logs', sa.Column('metadata_json', JSONB(astext_type=sa.Text()), nullable=True))

    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_type'), 'audit_logs', ['resource_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_id'), 'audit_logs', ['resource_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_business_reference'), 'audit_logs', ['business_reference'], unique=False)
    op.create_index(op.f('ix_audit_logs_organization_id'), 'audit_logs', ['organization_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_sector_id'), 'audit_logs', ['sector_id'], unique=False)

    # 2. Upgrade notifications table
    op.add_column('notifications', sa.Column('priority', sa.String(), nullable=False, server_default='NORMAL'))
    op.add_column('notifications', sa.Column('resource_type', sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('resource_id', UUID(as_uuid=True), nullable=True))
    op.add_column('notifications', sa.Column('business_reference', sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('action_url', sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('read_at', sa.DateTime(timezone=True), nullable=True))

    op.create_index(op.f('ix_notifications_recipient_id'), 'notifications', ['recipient_id'], unique=False)
    op.create_index(op.f('ix_notifications_type'), 'notifications', ['type'], unique=False)
    op.create_index(op.f('ix_notifications_priority'), 'notifications', ['priority'], unique=False)
    op.create_index(op.f('ix_notifications_is_read'), 'notifications', ['is_read'], unique=False)
    op.create_index(op.f('ix_notifications_resource_type'), 'notifications', ['resource_type'], unique=False)
    op.create_index(op.f('ix_notifications_resource_id'), 'notifications', ['resource_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_notifications_resource_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_resource_type'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_is_read'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_priority'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_type'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_recipient_id'), table_name='notifications')

    op.drop_column('notifications', 'read_at')
    op.drop_column('notifications', 'action_url')
    op.drop_column('notifications', 'business_reference')
    op.drop_column('notifications', 'resource_id')
    op.drop_column('notifications', 'resource_type')
    op.drop_column('notifications', 'priority')

    op.drop_index(op.f('ix_audit_logs_sector_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_organization_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_business_reference'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_resource_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_resource_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')

    op.drop_column('audit_logs', 'metadata_json')
    op.drop_column('audit_logs', 'sector_id')
    op.drop_column('audit_logs', 'organization_id')
    op.drop_column('audit_logs', 'reason')
    op.drop_column('audit_logs', 'business_reference')
