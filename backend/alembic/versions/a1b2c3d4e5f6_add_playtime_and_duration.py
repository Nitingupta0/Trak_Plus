"""add playtime and duration tracking

Revision ID: a1b2c3d4e5f6
Revises: 7f2c1d9a4b6e
Create Date: 2026-09-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "7f2c1d9a4b6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("library_entries", sa.Column("playtime_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("library_entries", "playtime_minutes")
