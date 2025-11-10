"""
New Products Validation Script
Validates 60 new product styles against Caspio Pricing Proxy API
Generates reports and SQL statements for marking products as isNew=true

Usage:
    python scripts/process-new-products.py
"""

import pandas as pd
import asyncio
import aiohttp
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import time

# API Configuration
API_BASE = "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api"

# New Products CSV Data (60 products)
CSV_DATA = """Style,Description,Category
EB120,Eddie Bauer® Adventurer 1/4-Zip,Outerwear/Jackets
EB121,Eddie Bauer® Women's Adventurer Full-Zip,Outerwear/Jackets
EB122,Eddie Bauer® Adventure 1/4-Zip Pullover,Outerwear/Jackets
EB123,Eddie Bauer® Trail Soft Shell Jacket,Outerwear/Jackets
EB124,Eddie Bauer® Dash Full-Zip Fleece,Outerwear/Jackets
EB125,Eddie Bauer® Rain Jacket,Outerwear/Jackets
EB126,Eddie Bauer® Highpoint Fleece Jacket,Outerwear/Jackets
EB127,Eddie Bauer® Parka,Outerwear/Jackets
EB128,Eddie Bauer® Fleece Vest,Outerwear/Jackets
EB130,Eddie Bauer® Ripstop Cap,Headwear
EB131,Eddie Bauer® Performance Snapback Cap,Headwear
EB132,Eddie Bauer® Snapback Trucker Cap,Headwear
EB133,Eddie Bauer® Ballcap,Headwear
EB201,Eddie Bauer® Travex® Carry-On,Bags
EB202,Eddie Bauer® Wheeled Duffel,Bags
DT700,District® Twill,Bags
DT710,District® Supersize Messenger,Bags
DT715,District® Zippered Tote,Bags
DT720,District® Drawstring Tote,Bags
DT730,District® Travel Organizer,Bags
DT740,District® Duffel,Bags
DT750,District® Backpack,Bags
DT760,District® Gym Sack,Bags
DT770,District® Sling Bag,Bags
DT620,District® Snapback Flat Bill Cap,Headwear
DT624,District® Camper Hat,Headwear
DT625,District® Five-Panel Cap,Headwear
DT626,District® Trucker Cap,Headwear
CT100617,Carhartt® Rain Defender® Paxton Heavyweight Hooded Zip Mock Sweatshirt,Outerwear/Jackets
CT103828,Carhartt® Duck Detroit Jacket,Outerwear/Jackets
CT104597,Carhartt® Watch Cap 2.0,Headwear
CT104670,Carhartt® Storm Defender® Shoreline Jacket,Outerwear/Jackets
CTK121,Carhartt® Midweight Hooded Sweatshirt,Fleece/Sweatshirts
CTB100632,Carhartt® Canvas Work Backpack,Bags
CTB109900,Carhartt® Duffel,Bags
CTG100893,Carhartt® Heavyweight Long Sleeve Pocket T-Shirt,Apparel
CTC05,Carhartt® Hat,Headwear
CTC04,Carhartt® Signature Canvas Mesh Back Cap,Headwear
CTC1001,Carhartt® Canvas Mesh Back Cap,Headwear
NE410,New Era® Original Fit Trucker Cap,Headwear
NE411,New Era® Flat Bill Trucker Cap,Headwear
NE412,New Era® Snapback Flat Bill Cap,Headwear
C136,Port Authority® Colorblock Tech Pique Polo,Apparel
C138,Port Authority® Colorblock 3-in-1 Jacket,Outerwear/Jackets
C141,Port Authority® Colorblock Soft Shell,Outerwear/Jackets
C144,Port Authority® Value Fleece Vest,Outerwear/Jackets
OG710,OGIO® Travel Kit,Bags
ST850,Sport-Tek® Sport-Wick® Stretch 1/4-Zip Pullover,Fleece/Sweatshirts
ST851,Sport-Tek® Sport-Wick® Stretch Contrast 1/4-Zip Pullover,Fleece/Sweatshirts
ST860,Sport-Tek® Sport-Wick® Stretch Pullover Hooded Sweatshirt,Fleece/Sweatshirts
ST861,Sport-Tek® Sport-Wick® Stretch Contrast Pullover Hooded Sweatshirt,Fleece/Sweatshirts
ST880,Sport-Tek® Sport-Wick® Stretch Full-Zip Jacket,Fleece/Sweatshirts
ST881,Sport-Tek® Sport-Wick® Stretch Contrast Full-Zip Jacket,Fleece/Sweatshirts
ST890,Sport-Tek® Sport-Wick® Stretch 1/2-Zip Pullover,Fleece/Sweatshirts
ST891,Sport-Tek® Sport-Wick® Stretch Contrast 1/2-Zip Pullover,Fleece/Sweatshirts
NF0A7V85,The North Face® Ladies Ridgewall Soft Shell Vest,Outerwear/Jackets
NF0A84JZ,The North Face® Ultimate Waterproof Jacket,Outerwear/Jackets
BB18200,Brooks Brothers® Non-Iron Stretch Long Sleeve Shirt,Apparel
CS410,CornerStone® Duck Cloth Work Pant,Apparel
CS415,CornerStone® Work Gloves,Accessories"""


@dataclass
class StyleCleaner:
    """Clean and normalize style numbers"""

    @staticmethod
    def clean_style(style: str) -> Tuple[str, str]:
        """
        Clean style number and extract size if present

        Examples:
            "C112_OSFA" -> ("C112", "OSFA")
            "CT104597_OSFA" -> ("CT104597", "OSFA")
            "PC54" -> ("PC54", "")
        """
        if '_' in style:
            parts = style.split('_', 1)  # Split on first underscore only
            return parts[0].strip(), parts[1].strip()
        return style.strip(), ''

    @staticmethod
    def detect_vendor(style: str) -> str:
        """Detect vendor from style prefix"""
        style_upper = style.upper()

        if style_upper.startswith('PC'):
            return 'Port & Company'
        elif style_upper.startswith('BC'):
            return 'Bella+Canvas'
        elif style_upper.startswith('C') and not style_upper.startswith('CT') and not style_upper.startswith('CS'):
            return 'Port Authority'
        elif style_upper.startswith('CT'):
            return 'Carhartt'
        elif style_upper.startswith('DT'):
            return 'District'
        elif style_upper.startswith('EB'):
            return 'Eddie Bauer'
        elif style_upper.startswith('NE'):
            return 'New Era'
        elif style_upper.startswith('NK'):
            return 'Nike'
        elif style_upper.startswith('ST'):
            return 'Sport-Tek'
        elif style_upper.startswith('TM'):
            return 'TravisMathew'
        elif style_upper.startswith('S'):
            return 'Port Authority'
        elif style_upper.startswith('NF'):
            return 'The North Face'
        elif style_upper.startswith('BB'):
            return 'Brooks Brothers'
        elif style_upper.startswith('OG'):
            return 'OGIO'
        elif style_upper.startswith('CS'):
            return 'CornerStone'
        else:
            return 'Unknown'


class APIValidator:
    """Validate styles against Caspio API with rate limiting"""

    def __init__(self, base_url: str, max_concurrent: int = 5, rate_limit: int = 30):
        self.base_url = base_url
        self.max_concurrent = max_concurrent
        self.rate_limit = rate_limit
        self.session: Optional[aiohttp.ClientSession] = None
        self.results_cache: Dict[str, Dict] = {}
        self.request_times: List[float] = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def rate_limit_wait(self):
        """Ensure we don't exceed rate limit"""
        now = time.time()
        # Remove requests older than 60 seconds
        self.request_times = [t for t in self.request_times if now - t < 60]

        if len(self.request_times) >= self.rate_limit:
            # Wait until oldest request is 60 seconds old
            wait_time = 60 - (now - self.request_times[0])
            if wait_time > 0:
                print(f"[WAIT] Rate limit reached, waiting {wait_time:.1f}s...")
                await asyncio.sleep(wait_time)
                self.request_times = []

        self.request_times.append(now)

    async def validate_style(self, style: str, retry=0) -> Dict:
        """Validate style against API with retry logic"""
        if style in self.results_cache:
            return self.results_cache[style]

        try:
            await self.rate_limit_wait()

            # Use product-details endpoint (same as product.html page)
            url = f"{self.base_url}/product-details?styleNumber={style}"
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()

                    # product-details returns array of color variants
                    if isinstance(data, list) and len(data) > 0:
                        # Product exists - extract info from first color variant
                        first_variant = data[0]
                        result = {
                            'exists': True,
                            'api_is_new': first_variant.get('isNew', False),
                            'api_best_seller': first_variant.get('isBestSeller', False),
                            'title': first_variant.get('PRODUCT_TITLE', ''),
                            'brand': first_variant.get('BRAND_NAME', ''),
                            'category': first_variant.get('CATEGORY_NAME', ''),
                            'status': first_variant.get('PRODUCT_STATUS', 'Unknown'),
                            'error': None
                        }
                    else:
                        # Empty array = product not found
                        result = {
                            'exists': False,
                            'api_is_new': False,
                            'api_best_seller': False,
                            'title': '',
                            'brand': '',
                            'category': '',
                            'status': 'Not Found',
                            'error': None
                        }

                    self.results_cache[style] = result
                    return result

                elif response.status == 429:  # Rate limited
                    if retry < 3:
                        wait_time = (retry + 1) * 5
                        print(f"[WARN] Rate limited for {style}, retry {retry + 1}/3 in {wait_time}s")
                        await asyncio.sleep(wait_time)
                        return await self.validate_style(style, retry + 1)
                    else:
                        result = {
                            'exists': False,
                            'api_is_new': False,
                            'api_best_seller': False,
                            'title': '',
                            'brand': '',
                            'category': '',
                            'status': 'Error',
                            'error': f"Rate limited after {retry + 1} retries"
                        }
                        self.results_cache[style] = result
                        return result
                else:
                    result = {
                        'exists': False,
                        'api_is_new': False,
                        'api_best_seller': False,
                        'title': '',
                        'brand': '',
                        'category': '',
                        'status': 'Error',
                        'error': f"API returned status {response.status}"
                    }
                    self.results_cache[style] = result
                    return result

        except asyncio.TimeoutError:
            result = {
                'exists': False,
                'api_is_new': False,
                'api_best_seller': False,
                'title': '',
                'brand': '',
                'category': '',
                'status': 'Error',
                'error': 'Request timeout'
            }
            self.results_cache[style] = result
            return result

        except Exception as e:
            result = {
                'exists': False,
                'api_is_new': False,
                'api_best_seller': False,
                'title': '',
                'brand': '',
                'category': '',
                'status': 'Error',
                'error': str(e)
            }
            self.results_cache[style] = result
            return result

    async def validate_batch(self, styles: List[str]) -> Dict[str, Dict]:
        """Validate multiple styles with concurrency control"""
        results = {}

        # Process in batches
        for i in range(0, len(styles), self.max_concurrent):
            batch = styles[i:i + self.max_concurrent]
            print(f"[SEARCH] Validating batch {i//self.max_concurrent + 1}/{(len(styles) + self.max_concurrent - 1)//self.max_concurrent} ({len(batch)} styles)...")

            # Process batch concurrently
            tasks = [self.validate_style(style) for style in batch]
            batch_results = await asyncio.gather(*tasks)

            # Store results
            for style, result in zip(batch, batch_results):
                results[style] = result

        return results


class NewProductProcessor:
    """Main processor for new products validation"""

    def __init__(self):
        self.cleaner = StyleCleaner()
        self.stats = defaultdict(int)

    def load_data(self) -> pd.DataFrame:
        """Load CSV data from embedded string"""
        from io import StringIO
        print("[DATA] Loading CSV data...")
        df = pd.read_csv(StringIO(CSV_DATA))
        self.stats['total_original'] = len(df)
        print(f"[OK] Loaded {len(df)} products")
        return df

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean style numbers and extract sizes"""
        print("[CLEAN] Cleaning style numbers...")

        # Apply cleaning
        cleaning_results = df['Style'].apply(self.cleaner.clean_style)
        df['Style_Cleaned'] = cleaning_results.apply(lambda x: x[0])
        df['Size_Extracted'] = cleaning_results.apply(lambda x: x[1])

        # Detect vendors
        df['Vendor_Detected'] = df['Style_Cleaned'].apply(self.cleaner.detect_vendor)

        # Rename original columns
        df = df.rename(columns={
            'Style': 'Style_Original',
            'Description': 'Description',
            'Category': 'Category'
        })

        print(f"[OK] Cleaned {len(df)} products")
        return df

    def remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove duplicate style + category combinations"""
        print("[PROCESS] Removing duplicates...")
        before = len(df)

        df = df.drop_duplicates(subset=['Style_Cleaned', 'Category'], keep='first')

        after = len(df)
        duplicates_removed = before - after
        self.stats['duplicates_removed'] = duplicates_removed
        self.stats['total_cleaned'] = after

        if duplicates_removed > 0:
            print(f"[OK] Removed {duplicates_removed} duplicates ({after} unique products)")
        else:
            print(f"[OK] No duplicates found ({after} unique products)")

        return df

    async def validate_products(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate products against API"""
        print("[SEARCH] Validating products against API...")

        # Get unique styles
        unique_styles = df['Style_Cleaned'].unique().tolist()
        self.stats['unique_styles'] = len(unique_styles)

        # Validate in batches
        async with APIValidator(API_BASE) as validator:
            validation_results = await validator.validate_batch(unique_styles)

        # Map results back to DataFrame
        df['API_Exists'] = df['Style_Cleaned'].map(lambda s: validation_results[s]['exists'])
        df['API_IsNew'] = df['Style_Cleaned'].map(lambda s: validation_results[s]['api_is_new'])
        df['API_BestSeller'] = df['Style_Cleaned'].map(lambda s: validation_results[s]['api_best_seller'])
        df['API_Title'] = df['Style_Cleaned'].map(lambda s: validation_results[s]['title'])
        df['API_Brand'] = df['Style_Cleaned'].map(lambda s: validation_results[s]['brand'])
        df['API_Category'] = df['Style_Cleaned'].map(lambda s: validation_results[s]['category'])
        df['API_Status'] = df['Style_Cleaned'].map(lambda s: validation_results[s]['status'])
        df['API_Error'] = df['Style_Cleaned'].map(lambda s: validation_results[s]['error'] or '')

        # Calculate stats
        found = df['API_Exists'].sum()
        not_found = len(df) - found
        self.stats['found_in_api'] = found
        self.stats['not_found_in_api'] = not_found
        self.stats['match_rate'] = (found / len(df) * 100) if len(df) > 0 else 0

        # Count already marked as new
        already_new = df[df['API_Exists'] & df['API_IsNew']].shape[0]
        need_new_flag = df[df['API_Exists'] & ~df['API_IsNew']].shape[0]
        self.stats['already_new'] = already_new
        self.stats['need_new_flag'] = need_new_flag

        print(f"[OK] Validation complete: {found} found, {not_found} not found ({self.stats['match_rate']:.1f}% match rate)")
        if already_new > 0:
            print(f"[INFO] {already_new} products already marked as new in API")
        if need_new_flag > 0:
            print(f"[INFO] {need_new_flag} products need isNew flag set to true")

        return df

    def generate_statistics(self, df: pd.DataFrame) -> Dict:
        """Generate detailed statistics"""
        print("[STATS] Generating statistics...")

        stats = {
            'summary': {
                'total_original': self.stats['total_original'],
                'total_cleaned': self.stats['total_cleaned'],
                'duplicates_removed': self.stats['duplicates_removed'],
                'unique_styles': self.stats['unique_styles'],
                'found_in_api': self.stats['found_in_api'],
                'not_found_in_api': self.stats['not_found_in_api'],
                'match_rate': self.stats['match_rate'],
                'already_new': self.stats['already_new'],
                'need_new_flag': self.stats['need_new_flag']
            },
            'by_vendor': df['Vendor_Detected'].value_counts().to_dict(),
            'by_category': df['Category'].value_counts().to_dict(),
            'found_by_vendor': df[df['API_Exists']].groupby('Vendor_Detected').size().to_dict(),
            'not_found_by_vendor': df[~df['API_Exists']].groupby('Vendor_Detected').size().to_dict()
        }

        print("[OK] Statistics generated")
        return stats

    def save_results(self, df: pd.DataFrame, stats: Dict):
        """Save all output files"""
        print("[SAVE] Saving results...")

        # 1. Complete dataset
        output_file = 'cleaned_new_products.csv'
        df.to_csv(output_file, index=False)
        print(f"[OK] Saved complete dataset: {output_file}")

        # 2. Not found products
        not_found = df[~df['API_Exists']].copy()
        not_found_file = 'new_products_not_found.csv'
        not_found.to_csv(not_found_file, index=False)
        print(f"[OK] Saved not found products: {not_found_file}")

        # 3. Products needing isNew flag
        need_flag = df[df['API_Exists'] & ~df['API_IsNew']].copy()
        need_flag_file = 'new_products_need_flag.csv'
        need_flag.to_csv(need_flag_file, index=False)
        print(f"[OK] Saved products needing flag: {need_flag_file}")

        # 4. Already marked as new
        already_new = df[df['API_Exists'] & df['API_IsNew']].copy()
        already_new_file = 'new_products_already_new.csv'
        already_new.to_csv(already_new_file, index=False)
        print(f"[OK] Saved already new products: {already_new_file}")

        # 5. Detailed report
        self._save_report(stats, df)

        print(f"\n[FILES] Generated 5 output files:")
        print(f"  1. {output_file} - Complete dataset")
        print(f"  2. {not_found_file} - Products not in API")
        print(f"  3. {need_flag_file} - Products needing isNew=true")
        print(f"  4. {already_new_file} - Already marked as new")
        print(f"  5. new_products_validation_report.txt - Detailed report")

    def _save_report(self, stats: Dict, df: pd.DataFrame):
        """Save detailed validation report"""
        report_file = 'new_products_validation_report.txt'

        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("=" * 70 + "\n")
            f.write("NEW PRODUCTS VALIDATION REPORT\n")
            f.write("=" * 70 + "\n\n")
            f.write(f"Generated: {pd.Timestamp.now()}\n\n")

            # Summary statistics
            f.write("SUMMARY STATISTICS\n")
            f.write("-" * 70 + "\n")
            for key, value in stats['summary'].items():
                label = key.replace('_', ' ').title()
                if key == 'match_rate':
                    f.write(f"{label}: {value:.1f}%\n")
                else:
                    f.write(f"{label}: {value}\n")
            f.write("\n")

            # Products by vendor
            f.write("PRODUCTS BY VENDOR\n")
            f.write("-" * 70 + "\n")
            for vendor, count in sorted(stats['by_vendor'].items(), key=lambda x: -x[1]):
                f.write(f"{vendor}: {count}\n")
            f.write("\n")

            # Products by category
            f.write("PRODUCTS BY CATEGORY\n")
            f.write("-" * 70 + "\n")
            for category, count in sorted(stats['by_category'].items(), key=lambda x: -x[1]):
                f.write(f"{category}: {count}\n")
            f.write("\n")

            # Found by vendor
            if stats['found_by_vendor']:
                f.write("FOUND IN API BY VENDOR\n")
                f.write("-" * 70 + "\n")
                for vendor, count in sorted(stats['found_by_vendor'].items(), key=lambda x: -x[1]):
                    f.write(f"{vendor}: {count}\n")
                f.write("\n")

            # Not found by vendor
            if stats['not_found_by_vendor']:
                f.write("NOT FOUND IN API BY VENDOR\n")
                f.write("-" * 70 + "\n")
                for vendor, count in sorted(stats['not_found_by_vendor'].items(), key=lambda x: -x[1]):
                    f.write(f"{vendor}: {count}\n")
                f.write("\n")

            # Products needing isNew flag
            need_flag = df[df['API_Exists'] & ~df['API_IsNew']]
            if len(need_flag) > 0:
                f.write("PRODUCTS NEEDING isNew FLAG\n")
                f.write("-" * 70 + "\n")
                f.write(f"Total: {len(need_flag)} products\n\n")
                for _, row in need_flag.iterrows():
                    f.write(f"Style: {row['Style_Cleaned']}\n")
                    f.write(f"  Description: {row['Description']}\n")
                    f.write(f"  Category: {row['Category']}\n")
                    f.write(f"  Vendor: {row['Vendor_Detected']}\n")
                    f.write(f"  API Title: {row['API_Title']}\n")
                    f.write("\n")

            # Products not found
            not_found = df[~df['API_Exists']]
            if len(not_found) > 0:
                f.write("PRODUCTS NOT FOUND IN API\n")
                f.write("-" * 70 + "\n")
                f.write(f"Total: {len(not_found)} products\n\n")

                # Group by vendor
                for vendor in not_found['Vendor_Detected'].unique():
                    vendor_products = not_found[not_found['Vendor_Detected'] == vendor]
                    f.write(f"\n{vendor} ({len(vendor_products)} products):\n")
                    f.write("-" * 70 + "\n")

                    for _, row in vendor_products.iterrows():
                        f.write(f"\nStyle: {row['Style_Cleaned']}\n")
                        if row['Style_Original'] != row['Style_Cleaned']:
                            f.write(f"  Original: {row['Style_Original']}\n")
                        f.write(f"  Description: {row['Description']}\n")
                        f.write(f"  Category: {row['Category']}\n")
                        if row['API_Error']:
                            f.write(f"  Error: {row['API_Error']}\n")

            # Recommendations
            f.write("\n" + "=" * 70 + "\n")
            f.write("RECOMMENDATIONS\n")
            f.write("=" * 70 + "\n\n")

            if stats['summary']['need_new_flag'] > 0:
                f.write(f"1. UPDATE DATABASE:\n")
                f.write(f"   {stats['summary']['need_new_flag']} products need isNew flag set to true\n")
                f.write(f"   See: new_products_need_flag.csv\n\n")

            if stats['summary']['not_found_in_api'] > 0:
                f.write(f"2. ADD MISSING PRODUCTS:\n")
                f.write(f"   {stats['summary']['not_found_in_api']} products not found in API\n")
                f.write(f"   See: new_products_not_found.csv\n\n")

            if stats['summary']['already_new'] > 0:
                f.write(f"3. ALREADY CONFIGURED:\n")
                f.write(f"   {stats['summary']['already_new']} products already marked as new\n")
                f.write(f"   See: new_products_already_new.csv\n\n")

            f.write("4. NEXT STEPS:\n")
            f.write("   - Review products needing isNew flag\n")
            f.write("   - Add missing products to database\n")
            f.write("   - Create new-products-showcase.html page\n")
            f.write("   - Update navigation with 'New Products' link\n")

        print(f"[OK] Saved validation report: {report_file}")

    async def process(self):
        """Main processing pipeline"""
        print("\n" + "=" * 70)
        print("NEW PRODUCTS VALIDATION SCRIPT")
        print("=" * 70 + "\n")

        # 1. Load data
        df = self.load_data()

        # 2. Clean data
        df = self.clean_data(df)

        # 3. Remove duplicates
        df = self.remove_duplicates(df)

        # 4. Validate against API
        df = await self.validate_products(df)

        # 5. Generate statistics
        stats = self.generate_statistics(df)

        # 6. Save results
        self.save_results(df, stats)

        print("\n" + "=" * 70)
        print("VALIDATION COMPLETE")
        print("=" * 70 + "\n")

        # Print summary
        print(f"Processed: {stats['summary']['total_cleaned']} products")
        print(f"Found in API: {stats['summary']['found_in_api']}")
        print(f"Not found: {stats['summary']['not_found_in_api']}")
        print(f"Match rate: {stats['summary']['match_rate']:.1f}%")
        print(f"Already marked as new: {stats['summary']['already_new']}")
        print(f"Need isNew flag: {stats['summary']['need_new_flag']}")


async def main():
    """Entry point"""
    processor = NewProductProcessor()
    await processor.process()


if __name__ == '__main__':
    asyncio.run(main())
