from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey, Text, JSON, DateTime, func, Table, Column


class Base(DeclarativeBase):
    pass


# Association tables
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.ID"), primary_key=True),
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
)

user_groups = Table(
    "USER_GROUPS",  # Oracle table name (uppercase)
    Base.metadata,
    Column("USER_ID", ForeignKey("users.ID"), primary_key=True),
    Column("GROUP_ID", ForeignKey("groups.id"), primary_key=True),
)

role_groups = Table(
    "ROLE_GROUPS",  # Oracle table name (uppercase)
    Base.metadata,
    Column("ROLE_ID", ForeignKey("roles.id"), primary_key=True),
    Column("GROUP_ID", ForeignKey("groups.id"), primary_key=True),
)

user_dashboard_privs = Table(
    "USER_DASHBOARD_PRIVS",  # Oracle table name (uppercase)
    Base.metadata,
    Column("USER_ID", ForeignKey("users.ID"), primary_key=True),
    Column("DASHBOARD_ID", ForeignKey("dashboards.id"), primary_key=True),
    Column("LAST_OPENED")
)


class User(Base):
    __tablename__ = "users"

    # Existing Oracle schema columns
    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column("USERNAME", String(50))
    email: Mapped[str] = mapped_column("EMAIL", String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column("PASSWORD_HASH", String(255))
    created_at: Mapped[DateTime] = mapped_column("CREATED_AT", DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime | None] = mapped_column("UPDATED_AT", DateTime(timezone=True), nullable=True)
    last_login: Mapped[DateTime | None] = mapped_column("LAST_LOGIN", DateTime(timezone=True), nullable=True)
    enabled: Mapped[int] = mapped_column("ENABLED", Integer)  # 1/0
    role: Mapped[str] = mapped_column("ROLE", String(255))

    # Relationship-based RBAC
    roles = relationship("Role", secondary=user_roles, back_populates="users", lazy="joined")
    groups = relationship("Group", secondary=user_groups, back_populates="users", lazy="joined")
    dashboards = relationship("Dashboard", secondary=user_dashboard_privs, back_populates="users", lazy="joined")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")

    users = relationship("User", secondary=user_roles, back_populates="roles")
    groups = relationship("Group", secondary=role_groups, back_populates="roles")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")

    users = relationship("User", secondary=user_groups, back_populates="groups")
    roles = relationship("Role", secondary=role_groups, back_populates="groups")


class SavedQuery(Base):
    __tablename__ = "saved_queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.ID"))
    name: Mapped[str] = mapped_column(String(255), index=True)
    sql_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Dashboard(Base):
    __tablename__ = "dashboards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(String(255))
    # JSON schema to store layout, widgets, and references to SavedQuery
    
    users = relationship("User", secondary=user_dashboard_privs, back_populates="dashboards", lazy="joined")


