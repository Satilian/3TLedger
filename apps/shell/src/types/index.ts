export type { BaseRequest } from './base-request';
export type { ApiResponse } from './api-response';
export type { AppLoaderCtx as LoaderCtx } from './loader-context';
// Admin types
export type { CurrencyType, ImageType, PageMetaType, PriceType, UnitType } from './admin';
export type { CategoryType, CategoryDto, CategoryBatchUpdateDto } from './admin/category';
export type { ProductType, ProductDto, ProductBatchUpdateDto, ImageUploadResponseDto } from './admin/product';
export {
  REQUIRED_CATEGORY_FIELDS,
  REQUIRED_PRODUCT_FIELDS,
  VALIDATION_RULES,
  isValidSlug,
  validateAndParseJson,
  buildValidationErrors,
} from './admin/validation';

// Auth types
export type { AuthUserType, AuthResponse } from './auth';
export type { LoginCredentials, RegisterData, PublicUser } from './auth';

// About settings
export type { AboutSettings, AboutSettingsUpdateData } from './about-settings';

// Footer settings
export type { FooterSettings, FooterSettingsUpdateData, FooterColumn, FooterLink } from './footer-settings';

// Featured products
export type {
  FeaturedProduct,
  FeaturedProductsSettingsResult,
  FeaturedProductsSettingsUpdateData,
  FeaturedProductsSettingsFormValues,
} from './featured-products';

// Contacts settings
export type { ContactsSettings, ContactsSettingsUpdateData, HeaderContactsSettings } from './contacts-settings';

// Delivery settings
export type { DeliverySettings, DeliverySettingsUpdateData } from './delivery-settings';

// Promotional offers settings
export type {
  PromotionalOfferItem,
  PromotionalOffersSettings,
  PromotionalOffersSettingsUpdateData,
} from './promotional-offers';

// Hero settings
export type { HeroSettings, HeroSettingsUpdateData } from './hero-settings';

// Loader data
export type { LoaderDataItem } from './loader-data-item';
export type { PaginatedResponse } from './pagination';

// Product categories
export type {
  ProductCategoriesSettings,
  ProductCategoriesSettingsResult,
  ProductCategoriesSettingsUpdateData,
  ProductCategoriesSettingsWithCategories,
  ProductCategoryDisplayData,
  ProductCategoriesSettingsFormValues,
} from './product-categories';

// Query keys
export {
  QueryKeys,
  authQueryKeys,
  adminCategoriesQueryKeys,
  adminProductsQueryKeys,
  adminLibraryImagesQueryKeys,
} from './queery-keys';

// API catalog types
export type {
  Breadcrumbs,
  CategoriesByParentIdResponse,
  CategoryBySlugResponse,
  ProductsListResponse,
  CategoryChildItem,
  CategoryParentItem,
  ImageLite,
  ProductListItem,
  ProductsByParentIdResponse,
  ProductsBySlugIdResponse,
  TreeItem,
} from './catalog';
