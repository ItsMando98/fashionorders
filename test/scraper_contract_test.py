"""Run inside the scraper environment: python test/scraper_contract_test.py."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

source = pathlib.Path(__file__).resolve().parents[1] / "scraper_service" / "main.py"
if not source.exists():
    source = pathlib.Path('/srv/main.py')
spec = importlib.util.spec_from_file_location('fashion_scraper', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Node:
    def __init__(self, text='', **attributes):
        self.text = text
        self.attrib = attributes

    def css(self, _selector):
        return []


class Page:
    def __init__(self, status=200, title='Hoodie 200 CNY'):
        self.status = status
        self.title = title
        self.body = ''

    def css(self, selector):
        if selector == '.showalbumheader__gallerytitle':
            return [Node(self.title)] if self.title else []
        if selector == '.showalbumheader__gallerysubtitle':
            return [Node('Cotton')]
        if selector == 'meta[property="og:image"]':
            return [Node(content='https://photo.yupoo.com/seller/front.jpg')]
        if selector.startswith('[data-origin-src]'):
            return [Node(**{'data-origin-src': '//photo.yupoo.com/seller/front.jpg'}), Node(**{'data-src': '//photo.yupoo.com/seller/back.jpg'})]
        return []


class ScraperContract(unittest.TestCase):
    def test_one_album_returns_a_gallery_not_separate_products(self):
        with patch.object(module, 'fetch_yupoo_page', return_value=(Page(), False)):
            result = module.scrape_yupoo('https://seller.x.yupoo.com/albums/123')
        self.assertEqual(len(result['images']), 2)
        self.assertEqual(result['variant_hints']['sizes'], [])
        self.assertEqual(result['price_cny'], 200)

    def test_404_with_generic_cover_is_not_a_product(self):
        with patch.object(module, 'fetch_yupoo_page', return_value=(Page(status=404, title=''), False)):
            with self.assertRaises(module.HTTPException):
                module.scrape_yupoo('https://seller.x.yupoo.com/albums/123')

    def test_missing_album_identity_is_not_synthesized(self):
        with patch.object(module, 'fetch_yupoo_page', return_value=(Page(title=''), False)):
            with self.assertRaises(module.HTTPException):
                module.scrape_yupoo('https://seller.x.yupoo.com/albums/123')

    def test_procurement_links_are_canonical_and_allowlisted(self):
        self.assertEqual(module.procurement_link('https://item.taobao.com/item.htm?id=1058102530419&spm=tracking'), 'https://item.taobao.com/item.htm?id=1058102530419')
        self.assertIsNone(module.procurement_link('https://item.taobao.com.evil.com/item.htm?id=123'))
        self.assertEqual(module.procurement_links(None, 'Order https://weidian.com/item.html?itemID=123', ''), ['https://weidian.com/item.html?itemID=123'])

    def test_sizes_and_colors_are_hints_from_source_only(self):
        self.assertEqual(module.variant_hints('尺码：M L XL\n颜色：黑 咖啡 紫色'), {'sizes':['M','L','XL'], 'colors':['黑','咖啡','紫色']})
        self.assertEqual(module.variant_hints('Cotton'), {'sizes':[], 'colors':[]})

    def test_original_and_thumbnail_are_one_gallery_photo(self):
        self.assertEqual(module.unique_product_images(['https://photo.yupoo.com/seller/0841ec36ad/medium.png','https://photo.yupoo.com/seller/0841ec36ad/446394ad.png']), ['https://photo.yupoo.com/seller/0841ec36ad/446394ad.png'])

    def test_gallery_has_no_photo_quota(self):
        urls = [f'https://photo.yupoo.com/seller/image-{i}.jpg' for i in range(120)]
        self.assertEqual(len(module.unique_product_images(urls)),120)

    def test_plain_404_uses_browser_fallback(self):
        self.assertTrue(module.looks_blocked(Page(status=404)))


if __name__ == '__main__':
    unittest.main()
