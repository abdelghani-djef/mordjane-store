from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.schemas.catalog import media_url

LOGO_HEIGHT = Field(40, ge=24, le=96)


class AppearanceIn(BaseModel):
    logo_height: int = LOGO_HEIGHT


class AppearanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hero_image_path: str | None = Field(exclude=True)
    logo_image_path: str | None = Field(exclude=True)
    logo_dark_image_path: str | None = Field(exclude=True)
    logo_height: int = LOGO_HEIGHT

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

    # None: the light logo is used in the dark theme too.
    @computed_field
    @property
    def logo_dark_image_url(self) -> str | None:
        return media_url(self.logo_dark_image_path)
