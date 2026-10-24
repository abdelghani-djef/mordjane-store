from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.schemas.catalog import media_url


class AppearanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hero_image_path: str | None = Field(exclude=True)
    logo_image_path: str | None = Field(exclude=True)

    # None: the storefront shows its built-in photo.
    @computed_field
    @property
    def hero_image_url(self) -> str | None:
        return media_url(self.hero_image_path)

    # None: the storefront shows its built-in mark and name.
    @computed_field
    @property
    def logo_image_url(self) -> str | None:
        return media_url(self.logo_image_path)
