"""
Пример запуска Telegram-бота с кнопкой Mini App для игры в ЭНИП-Тетрис.

Перед запуском:
1. Зарегистрируйте бота в @BotFather и получите токен (BOT_TOKEN).
2. Опубликуйте игру в веб (например, через GitHub Pages, Vercel или ngrok) 
   и укажите публичный HTTPS-адрес в переменной WEB_APP_URL.
3. Установите библиотеку: pip install aiogram
4. Запустите: python bot.py
"""

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# === НАСТРОЙКИ ===
BOT_TOKEN = "ВАШ_ТОКЕН_ОТ_BOTFATHER"
# Важно: Telegram требует протокол HTTPS (например, ngrok / GitHub Pages / Vercel)
WEB_APP_URL = "https://your-domain.com/index.html"

dp = Dispatcher()

@dp.message(CommandStart())
async def command_start_handler(message: types.Message):
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🕹️ Играть в ЭНИП-Тетрис",
                    web_app=WebAppInfo(url=WEB_APP_URL)
                )
            ]
        ]
    )
    await message.answer(
        f"Привет, {message.from_user.first_name}!\n\n"
        "Добро пожаловать в **ЭНИП-Тетрис**!\n"
        "Нажмите кнопку ниже, чтобы запустить игру прямо в Telegram.",
        reply_markup=kb,
        parse_mode="Markdown"
    )

async def main():
    if BOT_TOKEN == "ВАШ_ТОКЕН_ОТ_BOTFATHER":
        print("ВНИМАНИЕ: Укажите реальный BOT_TOKEN в файле bot.py!")
        print("Для локального тестирования игры в браузере запустите: python run_server.py")
        return

    bot = Bot(token=BOT_TOKEN)
    await dp.start_polling(bot)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    asyncio.run(main())
