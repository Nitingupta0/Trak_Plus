"""add episode descriptions and thumbnails

Revision ID: 7f2c1d9a4b6e
Revises: bec220365eb9
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f2c1d9a4b6e"
down_revision: Union[str, Sequence[str], None] = "bec220365eb9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("episodes", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("episodes", sa.Column("thumbnail_url", sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column("episodes", "thumbnail_url")
    op.drop_column("episodes", "description")
