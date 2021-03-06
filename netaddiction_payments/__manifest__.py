# Copyright 2020 Openforce Srls Unipersonale (www.openforce.it)
# License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl).


{
    'name': "NetAddiction Payments",
    'summary': "Nuova Gestione Pagamenti",

    'description': """
    Modulo della gestione degi pagamenti
    """,
    'author': "Netaddiction",

    'website': "http://www.netaddiction.it",
    'category': 'Technical Settings',
    'version': '14.0.1.0.0',
    'depends': [
        'account',
        'product',
        'sale',
    ],
    'data': [
        'data/account_journal.xml',
        'data/cash_on_delivery.xml',
        'views/sale_order.xml',
        'views/stock_picking.xml',
    ]
}
