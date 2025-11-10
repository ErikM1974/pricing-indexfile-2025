"""
Top Sellers CSV Processor & API Validator

Purpose:
1. Parse top sellers CSV data
2. Clean style numbers (remove size suffixes)
3. Validate against Caspio Pricing Proxy API
4. Generate cleaned dataset with validation results
5. Provide recommendations for database updates

Author: Claude
Date: 2025-01-27
"""

import asyncio
import aiohttp
import pandas as pd
from typing import Dict, List, Tuple
from datetime import datetime
import sys

# Configuration
API_BASE = "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api"
OUTPUT_DIR = "."

# Order Type to Decoration Method mapping
ORDER_TYPE_MAP = {
    'Screenprinting': 'screenprint',
    'Custom Embroidery': 'embroidery',
    'Cap Order': 'caps'
}

# CSV Data (embedded)
CSV_DATA = """Style,Description,Order Type
18500,Gildan - Heavy Blend Hooded Sweatshirt,Screenprinting
2000,Gildan - Ultra Cotton 100 Us Cotton T-Shirt,Screenprinting
267020,Nike Dri-Fit Classic Polo,Custom Embroidery
BC3001,BellaCanvas  Unisex Jersey Short Sleeve Tee,Screenprinting
C110_OSFA,Port Authority Flexfit 110 Mesh Cap,Cap Order
C112_OSFA,Port Authority Snapback Trucker Cap,Custom Embroidery
C112_OSFA,Port Authority Snapback Trucker Cap,Cap Order
C112_OSFA,Port Authority Snapback Trucker Cap.,Cap Order
C865_L/XL,Port Authority Flexfit Cap,Cap Order
CP82_OSFA,Port  Companybrushed Twill Cap,Cap Order
CP83_OSFA,Port  Company -Two-Tone Pigment-Dyed Cap,Cap Order
CP90_OSFA,Port  Companyknit Cap,Cap Order
CP90_OSFA,Port  Companyknit Cap,Screenprinting
CT100617,Carhartt  Rain Defender  Paxton Heavyweight Hooded Zip Mock Sweatshirt,Custom Embroidery
CT103828,Carhartt Duck Detroit Jacket,Custom Embroidery
CT104597_OSFA,Carhartt Watch Cap 2.0,Custom Embroidery
CT104670,Carhartt Storm Defender Shoreline Jacket,Custom Embroidery
CTK121,Carhartt  Midweight Hooded Sweatshirt,Custom Embroidery
DT6100,District V.i.t.fleece Hoodie,Screenprinting
EB532,Eddie Bauer Shaded Crosshatch Soft Shell Jacket,Custom Embroidery
EB550,Eddie Bauer - Rain Jacket (cream logo),Custom Embroidery
NE1000,New Era - Structured Stretch Cotton Cap,Cap Order
NE200_OSFA,New Era - Adjustable Structured Cap,Cap Order
NKDC1963,Nike Dri-Fit Micro Pique 2.0 Polo,Custom Embroidery
PC54,Port  Company - Core Cotton Tee,Screenprinting
PC55,Port  Company - Core Blend Tee,Screenprinting
PC55,Port  Co Core Blend Tee,Screenprinting
PC55P,Port  Company - Core Blend Pocket Tee,Screenprinting
PC600,Port  Company Bouncer Tee,Screenprinting
PC61,Port  Company - Essential Tee.,Screenprinting
PC78H,Port  Company - Core Fleece Pullover Hooded Sweatshirt,Screenprinting
PC78H_2X,Port  Company - Core Fleece Pullover Hooded Sweatshirt,Screenprinting
PC90H,Port  Company -  Essential Fleece Pullover Hooded Sweatshirt,Screenprinting
S608,Port Authority Long Sleeve Easy Care Shirt,Custom Embroidery
ST253,Sport-Tek 1/4-Zip Sweatshirt,Custom Embroidery
ST650,Sport-Tek Micropique Sport-Wick Polo,Custom Embroidery
ST850,Sport-Tek Sport-Wick Stretch 1/4-Zip Pullover,Custom Embroidery
TM1MU423_OSFA,Travismathew Cruz Trucker Cap,Cap Order"""


class StyleCleaner:
    """Handle style number cleaning and normalization"""

    @staticmethod
    def clean_style(style: str) -> Tuple[str, str]:
        """
        Clean style number and extract size if present

        Args:
            style: Original style number (e.g., "C112_OSFA", "PC78H_2X")

        Returns:
            Tuple of (cleaned_style, extracted_size)

        Examples:
            "C112_OSFA" → ("C112", "OSFA")
            "PC78H_2X" → ("PC78H", "2X")
            "PC54" → ("PC54", "")
        """
        if '_' in style:
            parts = style.split('_', 1)  # Split on first underscore only
            return parts[0].strip(), parts[1].strip()
        return style.strip(), ''

    @staticmethod
    def detect_vendor(style: str) -> str:
        """
        Detect vendor from style prefix

        Args:
            style: Cleaned style number

        Returns:
            Vendor name (best guess)
        """
        style_upper = style.upper()

        if style_upper.startswith('PC'):
            return 'Port & Company'
        elif style_upper.startswith('BC'):
            return 'Bella+Canvas'
        elif style_upper.startswith('C') and not style_upper.startswith('CT'):
            return 'Port Authority'
        elif style_upper.startswith('CT'):
            return 'Carhartt'
        elif style_upper.startswith('DT'):
            return 'District'
        elif style_upper.startswith('EB'):
            return 'Eddie Bauer'
        elif style_upper.startswith('NE') or style_upper.startswith('NK'):
            return 'Nike/New Era'
        elif style_upper.startswith('ST'):
            return 'Sport-Tek'
        elif style_upper.startswith('TM'):
            return 'TravisMathew'
        elif style_upper.startswith('S'):
            return 'Port Authority'
        else:
            return 'Unknown'


class APIValidator:
    """Validate styles against Caspio Pricing Proxy API"""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = None
        self.results_cache = {}

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()

    async def validate_style(self, style: str, retry=0) -> Dict:
        """
        Validate style against API

        Args:
            style: Cleaned style number
            retry: Retry counter for failed requests

        Returns:
            Dictionary with validation results
        """
        # Check cache first
        if style in self.results_cache:
            return self.results_cache[style]

        try:
            url = f"{self.base_url}/products/search?q={style}&limit=1"

            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()

                    # Check if we got results
                    products = data.get('products', [])

                    if products and len(products) > 0:
                        product = products[0]

                        # Check for exact match (case-insensitive)
                        if product.get('style', '').upper() == style.upper():
                            result = {
                                'exists': True,
                                'api_best_seller': product.get('isBestSeller', False),
                                'title': product.get('title', ''),
                                'brand': product.get('brand', ''),
                                'category': product.get('category', ''),
                                'status': product.get('status', 'Unknown'),
                                'error': None
                            }
                        else:
                            # Partial match - not exact
                            result = {
                                'exists': False,
                                'api_best_seller': False,
                                'title': '',
                                'brand': '',
                                'category': '',
                                'status': 'Not Found',
                                'error': f'Partial match only: {product.get("style")}'
                            }
                    else:
                        result = {
                            'exists': False,
                            'api_best_seller': False,
                            'title': '',
                            'brand': '',
                            'category': '',
                            'status': 'Not Found',
                            'error': None
                        }
                else:
                    result = {
                        'exists': False,
                        'api_best_seller': False,
                        'title': '',
                        'brand': '',
                        'category': '',
                        'status': 'API Error',
                        'error': f'HTTP {response.status}'
                    }

        except asyncio.TimeoutError:
            if retry < 2:
                print(f"   [WAIT]  Timeout for {style}, retrying...")
                await asyncio.sleep(1)
                return await self.validate_style(style, retry + 1)
            result = {
                'exists': False,
                'api_best_seller': False,
                'title': '',
                'brand': '',
                'category': '',
                'status': 'Timeout',
                'error': 'Request timed out'
            }

        except Exception as e:
            result = {
                'exists': False,
                'api_best_seller': False,
                'title': '',
                'brand': '',
                'category': '',
                'status': 'Error',
                'error': str(e)
            }

        # Cache result
        self.results_cache[style] = result
        return result

    async def validate_batch(self, styles: List[str], batch_size: int = 5) -> Dict[str, Dict]:
        """
        Validate multiple styles with rate limiting

        Args:
            styles: List of cleaned style numbers
            batch_size: Number of concurrent requests

        Returns:
            Dictionary mapping style to validation results
        """
        results = {}

        # Process in batches to avoid overwhelming API
        for i in range(0, len(styles), batch_size):
            batch = styles[i:i + batch_size]

            print(f"   Validating batch {i//batch_size + 1}/{(len(styles)-1)//batch_size + 1}...")

            tasks = [self.validate_style(style) for style in batch]
            batch_results = await asyncio.gather(*tasks)

            for style, result in zip(batch, batch_results):
                results[style] = result

            # Small delay between batches
            if i + batch_size < len(styles):
                await asyncio.sleep(0.5)

        return results


class TopSellerProcessor:
    """Main processor for top sellers data"""

    def __init__(self, output_dir: str = "."):
        self.output_dir = output_dir
        self.cleaner = StyleCleaner()
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    def load_data(self) -> pd.DataFrame:
        """Load and parse CSV data"""
        from io import StringIO
        return pd.read_csv(StringIO(CSV_DATA))

    async def process(self):
        """Main processing pipeline"""

        print("=" * 70)
        print("TOP SELLERS CSV PROCESSOR & API VALIDATOR")
        print("=" * 70)

        # 1. Load CSV
        print("\n Step 1: Loading CSV data...")
        df = self.load_data()
        print(f"   [OK] Loaded {len(df)} products")

        # 2. Clean style numbers
        print("\n Step 2: Cleaning style numbers...")
        df['Style_Original'] = df['Style']

        # Apply cleaning
        cleaning_results = df['Style'].apply(self.cleaner.clean_style)
        df['Style_Cleaned'] = cleaning_results.apply(lambda x: x[0])
        df['Size_Extracted'] = cleaning_results.apply(lambda x: x[1])
        df['Vendor_Detected'] = df['Style_Cleaned'].apply(self.cleaner.detect_vendor)

        # Show some examples
        examples = df[df['Size_Extracted'] != ''][['Style_Original', 'Style_Cleaned', 'Size_Extracted']].head(3)
        if not examples.empty:
            print("   Examples:")
            for _, row in examples.iterrows():
                print(f"      {row['Style_Original']} -> {row['Style_Cleaned']} (size: {row['Size_Extracted']})")

        # 3. Remove duplicates
        print("\n Step 3: Handling duplicates...")
        initial_count = len(df)

        # Keep first occurrence of each cleaned style + order type combo
        df = df.drop_duplicates(subset=['Style_Cleaned', 'Order Type'], keep='first')

        duplicates_removed = initial_count - len(df)
        if duplicates_removed > 0:
            print(f"   [OK] Removed {duplicates_removed} duplicate(s)")
        else:
            print(f"   [INFO]  No duplicates found")

        # 4. Map order types
        print("\n Step 4: Mapping order types to decoration methods...")
        df['Decoration_Method'] = df['Order Type'].map(ORDER_TYPE_MAP)

        # Count by decoration method
        method_counts = df['Decoration_Method'].value_counts()
        for method, count in method_counts.items():
            print(f"      {method}: {count} products")

        # 5. Validate against API
        print("\n Step 5: Validating against Caspio API...")
        print(f"   API Base: {API_BASE}")

        unique_styles = df['Style_Cleaned'].unique().tolist()
        print(f"   Total unique styles to validate: {len(unique_styles)}")

        async with APIValidator(API_BASE) as validator:
            validation_results = await validator.validate_batch(unique_styles)

        # 6. Map validation results back to dataframe
        print("\n Step 6: Processing validation results...")

        df['API_Exists'] = df['Style_Cleaned'].map(
            lambda x: validation_results.get(x, {}).get('exists', False)
        )
        df['API_BestSeller'] = df['Style_Cleaned'].map(
            lambda x: validation_results.get(x, {}).get('api_best_seller', False)
        )
        df['API_Title'] = df['Style_Cleaned'].map(
            lambda x: validation_results.get(x, {}).get('title', '')
        )
        df['API_Brand'] = df['Style_Cleaned'].map(
            lambda x: validation_results.get(x, {}).get('brand', '')
        )
        df['API_Category'] = df['Style_Cleaned'].map(
            lambda x: validation_results.get(x, {}).get('category', '')
        )
        df['API_Status'] = df['Style_Cleaned'].map(
            lambda x: validation_results.get(x, {}).get('status', '')
        )
        df['API_Error'] = df['Style_Cleaned'].map(
            lambda x: validation_results.get(x, {}).get('error', '')
        )

        # 7. Generate statistics
        print("\n Step 7: Generating statistics...")

        stats = {
            'total_products_original': initial_count,
            'total_products_cleaned': len(df),
            'duplicates_removed': duplicates_removed,
            'unique_styles': len(unique_styles),
            'found_in_api': int(df['API_Exists'].sum()),
            'not_found_in_api': int((~df['API_Exists']).sum()),
            'match_rate': f"{(df['API_Exists'].sum() / len(df) * 100):.1f}%",
            'already_best_sellers': int(df['API_BestSeller'].sum()),
            'need_best_seller_flag': int((df['API_Exists'] & ~df['API_BestSeller']).sum()),
            'discontinued': int((df['API_Status'] == 'Discontinued').sum())
        }

        # 8. Save results
        print("\n Step 8: Saving output files...")

        # Save cleaned CSV
        output_csv = f"cleaned_top_sellers.csv"
        df.to_csv(output_csv, index=False)
        print(f"   [OK] Saved: {output_csv}")

        # Save products not found
        not_found = df[~df['API_Exists']].copy()
        if not not_found.empty:
            not_found_csv = f"not_found.csv"
            not_found[['Style_Cleaned', 'Description', 'Order Type', 'Vendor_Detected']].to_csv(
                not_found_csv, index=False
            )
            print(f"   [WARN]  Not found list: {not_found_csv} ({len(not_found)} products)")

        # Save validation report
        report_file = f"validation_report.txt"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("=" * 70 + "\n")
            f.write("TOP SELLERS VALIDATION REPORT\n")
            f.write("=" * 70 + "\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            f.write("SUMMARY STATISTICS\n")
            f.write("-" * 70 + "\n")
            for key, value in stats.items():
                f.write(f"{key.replace('_', ' ').title()}: {value}\n")

            f.write("\n\nPRODUCTS BY DECORATION METHOD\n")
            f.write("-" * 70 + "\n")
            for method, count in method_counts.items():
                f.write(f"{method.title()}: {count}\n")

            if not not_found.empty:
                f.write("\n\nPRODUCTS NOT FOUND IN API\n")
                f.write("-" * 70 + "\n")
                for _, row in not_found.iterrows():
                    f.write(f"\nStyle: {row['Style_Cleaned']}\n")
                    f.write(f"  Original: {row['Style_Original']}\n")
                    f.write(f"  Description: {row['Description']}\n")
                    f.write(f"  Order Type: {row['Order Type']}\n")
                    f.write(f"  Detected Vendor: {row['Vendor_Detected']}\n")
                    if row['API_Error']:
                        f.write(f"  Error: {row['API_Error']}\n")

            # Products that exist but aren't marked as best sellers
            need_flag = df[df['API_Exists'] & ~df['API_BestSeller']]
            if not need_flag.empty:
                f.write("\n\nPRODUCTS NEEDING BEST SELLER FLAG\n")
                f.write("-" * 70 + "\n")
                f.write("These products exist in API but aren't marked as best sellers:\n\n")
                for _, row in need_flag.iterrows():
                    f.write(f"{row['Style_Cleaned']}: {row['API_Title']}\n")

        print(f"   [DOC] Validation report: {report_file}")

        # 9. Print summary to console
        print("\n" + "=" * 70)
        print(" PROCESSING SUMMARY")
        print("=" * 70)
        for key, value in stats.items():
            print(f"{key.replace('_', ' ').title()}: {value}")
        print("=" * 70)

        # 10. Print recommendations
        print("\n RECOMMENDATIONS:")
        print("-" * 70)

        if stats['not_found_in_api'] > 0:
            print(f"[WARN]  {stats['not_found_in_api']} products not found in API")
            print("   -> Review not_found.csv and add these to your database")

        if stats['need_best_seller_flag'] > 0:
            print(f"[TAG]  {stats['need_best_seller_flag']} products need isBestSeller flag updated")
            print("   -> Update these in Caspio database to mark as best sellers")

        if stats['already_best_sellers'] > 0:
            print(f"[OK] {stats['already_best_sellers']} products already marked as best sellers")

        if stats['discontinued'] > 0:
            print(f"[WARN]  {stats['discontinued']} products marked as discontinued")
            print("   -> Consider removing from top sellers list")

        print("\n[OK] Processing complete!")
        print(f"\n[FILES] Output files:")
        print(f"   - cleaned_top_sellers.csv")
        print(f"   - validation_report.txt")
        if not not_found.empty:
            print(f"   - not_found.csv")

        return df, stats


async def main():
    """Main entry point"""
    try:
        processor = TopSellerProcessor()
        df, stats = await processor.process()
        return 0
    except Exception as e:
        print(f"\n[ERROR] Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
