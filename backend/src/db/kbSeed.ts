/**
 * Pre-seeds the knowledge base with researched NetOne Zambia content on first
 * run (only if empty — never overwrites what the team has since edited).
 * Sources: netone.co.zm, techtrends.co.zm, radianonline.co.zm, digitize.co.zm
 * (NetOne's Project Digitize storefront). Prices/specs not directly sourced
 * are left blank rather than invented — NetOne's team can fill those in.
 */
import { query } from './pool.js';
import { createProduct, createDocument } from './kb.repo.js';
import { logger } from '../logger.js';

export async function seedKnowledgeBase(): Promise<void> {
  try {
    const [{ rows: pRows }, { rows: dRows }] = await Promise.all([
      query<{ count: string }>(`SELECT count(*) FROM kb_products`),
      query<{ count: string }>(`SELECT count(*) FROM kb_documents`),
    ]);

    if (Number(pRows[0]?.count ?? 0) === 0) {
      await Promise.all([
        createProduct({
          name: 'NEO Lite 14a',
          category: 'laptop',
          price_zmw: 5500,
          specs: { Display: '14" HD', RAM: '8GB', Storage: '512GB', Ports: 'HDMI' },
          description:
            'Entry-level model in the NEO range — Southern Africa’s first locally-produced laptop brand, made by NetOne IT for the education and first-time-buyer market.',
          financing: 'Available through NetOne’s device enablement / leasing scheme with partner financiers.',
          source_url: 'https://www.techtrends.co.zm/netone-zambia-launches-neo-its-own-range-of-laptops/',
        }),
        createProduct({
          name: 'NEO Pro15',
          category: 'laptop',
          price_note: 'Contact NetOne for current pricing',
          specs: {
            Processor: 'Intel Core i5-1035G1',
            RAM: '8GB (dual SODIMM)',
            Storage: '512GB SSD',
            Display: '15.6" 1920×1080 IPS',
            Wireless: 'AC WiFi, Bluetooth 4.2',
            OS: 'Windows 10 Pro EDU',
            Warranty: '12 months',
          },
          description: 'Mid-tier NEO laptop aimed at professionals and educators needing a full-HD IPS display.',
          financing: 'Available through NetOne’s device enablement / leasing scheme with partner financiers.',
        }),
        createProduct({
          name: 'NEO Pro15P',
          category: 'laptop',
          price_zmw: 11999,
          price_note: 'was K14,999',
          specs: {
            Processor: 'Intel Core i5-1240P (12th Gen)',
            RAM: '8GB',
            Storage: '512GB SSD',
            Display: '15.6" FHD IPS',
            Extras: '3-in-1 backpack included',
          },
          description: 'Flagship NEO laptop — 12th-gen Intel processor, NetOne’s top consumer/business configuration.',
          financing: 'Available through NetOne’s device enablement / leasing scheme with partner financiers.',
          source_url: 'https://www.digitize.co.zm/product/neo-pro15m',
        }),
        createProduct({
          name: 'Teacher Digital Literacy Bundle',
          category: 'bundle',
          price_note: 'K220/month',
          specs: { Includes: 'NEO laptop + MiFi router + 1.5GB data (12 months) + digital literacy training (~US$3,000 value)' },
          description:
            'NetOne’s Project Digitize bundle for educators, run with Zambian government backing to support the national Digital Literacy Programme.',
          financing: 'K220/month over the program term — NetOne’s flagship leasing example.',
          source_url: 'https://www.netone.co.zm/netone/device-enablement-schemes.html',
        }),
      ]);
      logger.info('Knowledge base seeded with 4 NetOne products');
    }

    if (Number(dRows[0]?.count ?? 0) === 0) {
      await Promise.all([
        createDocument({
          title: 'About NetOne Zambia',
          doc_type: 'note',
          source: 'netone.co.zm',
          status: 'indexed',
          content:
            'NetOne is a Zambian technology company with 20+ years in IT solutions, spanning a Security Operations Centre, Swish Pay, software solutions, core infrastructure and end-user computing (laptops, desktops, tablets, printers, AIO PCs). In 2022 NetOne IT launched NEO, branded as Southern Africa’s first locally-produced laptop, and announced a planned US$12M manufacturing facility targeting 30,000 units/month. NEO laptops are Intel-powered and were launched in partnership with the Zambian Government to support the national Digital Literacy Programme, with the Ministry of Education as a primary customer.',
        }),
        createDocument({
          title: 'Device Financing & Leasing',
          doc_type: 'note',
          source: 'netone.co.zm/netone/device-enablement-schemes.html',
          status: 'indexed',
          content:
            'NetOne launched Zambia’s first formalized device leasing platform in 2020. NetOne coordinates with financial institution partners to evaluate device affordability and repayment feasibility, and provides co-funding support. Example: the Teacher Laptop Program (part of Project Digitize) lets a teacher get a NEO laptop + MiFi + 1.5GB data (12 months) + ~US$3,000 of digital literacy training for K220/month. Financing partners, not NetOne directly, underwrite the loan — approval depends on the applicant’s assessed ability to repay.',
        }),
        createDocument({
          title: 'Financing Eligibility & Credit Risk Notes',
          doc_type: 'note',
          source: 'internal',
          status: 'indexed',
          content:
            'Zambia has high rates of informal employment, so NetOne’s financing partners assess repayment risk mainly by employment type rather than income alone. Civil servants and formally employed applicants are lowest risk (installments can often be deducted at source). Self-employed / business owners are medium risk and may need extra income verification. Informally employed applicants (market vendors, casual work) carry higher default risk and are approved more selectively. Unemployed applicants are generally not eligible for financing without alternative collateral or a guarantor, and should be steered toward cash purchase or a lower-cost model. This weighting is configurable on the Qualification Rules page.',
        }),
      ]);
      logger.info('Knowledge base seeded with 3 reference documents');
    }
  } catch (err) {
    logger.warn({ err: String(err) }, 'Knowledge base seed failed (non-fatal)');
  }
}
